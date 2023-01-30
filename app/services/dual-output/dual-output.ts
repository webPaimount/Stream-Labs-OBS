import { PersistentStatefulService, InitAfter, Inject, ViewHandler, mutation } from 'services/core';
import {
  TDualOutputPlatformSettings,
  DualOutputPlatformSettings,
  EDualOutputPlatform,
  // EOutputDisplayType,
  TDualOutputDisplayType,
  IDualOutputPlatformSetting,
} from './dual-output-data';
import { ScenesService, SceneItem } from 'services/scenes';
import { TDisplayType, VideoSettingsService } from 'services/settings-v2/video';
// import { ScenesService, TSceneNode } from 'services/scenes';
// import { SceneCollectionsService } from 'services/scene-collections';
import { CopyNodesCommand } from 'services/editor-commands/commands';
import { node } from 'execa';
// import { TPlatform } from 'services/platforms';
// import * as obs from '../../../obs-api';

// // @@@ TODO: Refactor dictionaries to Dictionary<<Record<string, TSceneNode>> to allow for multiple settings profiles?
// interface IDualOutputNodeIds {
//   horizontal: string;
//   vertical: string;
// }

interface IDualOutputServiceState {
  platformSettings: TDualOutputPlatformSettings;
  dualOutputMode: boolean;
  nodeMaps: { [display in TDisplayType]: Record<string, string> };
}

class DualOutputViews extends ViewHandler<IDualOutputServiceState> {
  get dualOutputMode() {
    return this.state.dualOutputMode;
  }

  get platformSettings() {
    return this.state.platformSettings;
  }

  get platformSettingsList(): IDualOutputPlatformSetting[] {
    return Object.values(this.state.platformSettings);
  }

  //   get horizontalSceneItems() {
  //   }

  //   get verticalSceneItems() {
  //   }

  //   get horizontalSceneItem() {
  //   }

  //   get verticalSceneItem() {
  //   }

  getDisplayNodeMap(display: TDisplayType) {
    return this.state.nodeMaps[display];
  }

  //   get hasDualOutputScenes() {
  //   }

  //   get showDualOutputDisplays() {
  //     return this.state.dualOutputMode && !!this.state.horizontalScene && !!this.state.verticalScene;
  //   }

  //   get hasNodeMaps() {
  //     return this.state.horizontalNodeMap && this.state.verticalNodeMap;
  //   }

  //   getPlatformDisplay(platform: TPlatform) {
  //     return this.state.platformSettings[platform].setting;
  //   }
}

@InitAfter('UserService')
@InitAfter('ScenesService')
@InitAfter('SceneCollectionsService')
@InitAfter('VideoSettingsService')
export class DualOutputService extends PersistentStatefulService<IDualOutputServiceState> {
  @Inject() private scenesService: ScenesService;
  //   @Inject() private sceneCollectionsService: SceneCollectionsService;
  @Inject() private videoSettingsService: VideoSettingsService;

  static defaultState: IDualOutputServiceState = {
    platformSettings: DualOutputPlatformSettings,
    dualOutputMode: false,
    nodeMaps: null,

    /**
     * nodeMaps: {
     *    [nodeId]: {
     *       [displayName]: mappedNodeId
     *    }
     * }
     * */
    // OR
    /**
     * nodeMaps: {
     *    [displayName]: {
     *      [originalSceneNodeId]: [newSceneNodeId]
     *    }
     * }
     *
     */
  };

  get views() {
    return new DualOutputViews(this.state);
  }

  init() {
    super.init();

    //     this.sceneCollectionsService.collectionInitialized.subscribe(() => {
    //       if (this.state.dualOutputMode) {
    //         this.createOutputNodes(['horizontal', 'vertical']);
    //       }
    //     });

    //     this.scenesService.sceneRemoved.subscribe(() => {
    //       if (this.state.dualOutputMode) {
    //         this.destroyOutputScenes(['horizontal', 'vertical']);
    //       }
    //     });

    //     this.scenesService.sceneSwitched.subscribe(() => {
    //       if (this.state.dualOutputMode && this.views.hasDualOutputScenes) {
    //         this.destroyOutputScenes(['horizontal', 'vertical']);
    //         this.createOutputNodes(['horizontal', 'vertical'], this.scenesService.views.activeSceneId);
    //       }
    //     });
  }

  async toggleDualOutputMode(status: boolean) {
    try {
      if (!status) {
        const destroyed = true; // @@@ TODO CALL FUNCTION HERE
        if (destroyed) {
          this.TOGGLE_DUAL_OUTPUT_MODE(status);
          return true;
        }
      } else {
        const created = true; // @@@ TODO CALL FUNCTION HERE
        if (created) {
          this.TOGGLE_DUAL_OUTPUT_MODE(status);
          return true;
        }
      }
      // if (!status) {
      //   const destroyed = this.destroyOutputScenes(['horizontal', 'vertical']);
      //   if (destroyed) {
      //     this.TOGGLE_DUAL_OUTPUT_MODE(status);
      //     return true;
      //   }
      // } else {
      //   const created = this.createOutputNodes(['horizontal', 'vertical']);
      //   if (created) {
      //     this.TOGGLE_DUAL_OUTPUT_MODE(status);
      //     return true;
      //   }
      // }
      return false;
    } catch (error: unknown) {
      console.error('Error toggling Dual Output mode: ', error);
      return false;
    }
  }

  @mutation()
  private TOGGLE_DUAL_OUTPUT_MODE(status: boolean) {
    this.state.dualOutputMode = status;
  }

  mapSceneNodes(displays: TDisplayType[], sceneId?: string) {
    const sceneToMapId = sceneId ?? this.scenesService.views.activeSceneId;
    return displays.reduce((created: boolean, display: TDisplayType, index) => {
      const isFirstDisplay = index === 0;
      const nodesCreated = this.createOutputNodes(sceneToMapId, display, isFirstDisplay);
      if (!nodesCreated) {
        created = false;
      }
      return created;
    }, true);
  }

  createOutputNodes(sceneId: string, display: TDisplayType, isFirstDisplay: boolean) {
    const sceneNodes = this.scenesService.views.getSceneItemsBySceneId(sceneId);
    return sceneNodes.reduce((created: boolean, sceneItem: SceneItem) => {
      const nodeCreated = this.createOrAssignOutputNode(
        sceneItem,
        display,
        isFirstDisplay,
        sceneId,
      );
      if (!nodeCreated) {
        created = false;
      }
      return created;
    }, true);
  }

  createOrAssignOutputNode(
    sceneItem: SceneItem,
    display: TDisplayType,
    isFirstDisplay: boolean,
    sceneId?: string,
  ) {
    if (isFirstDisplay) {
      // if it's the first display, just assign the scene item's output to a context
      const context = this.videoSettingsService.contexts[display];
      if (!context) {
        return false;
      }
      sceneItem.output = context;
    } else {
      // if it's not the first display, copy the scene item
      const scene = this.scenesService.views.getScene(sceneId);
      const copiedSceneItem = scene.addSource(sceneItem.sourceId);
      copiedSceneItem.setSettings(sceneItem.getSettings());
      this.SET_NODE_MAP_ITEM(display, sceneItem.id, copiedSceneItem.id);
      return true;
    }
    return false;
  }

  @mutation()
  private SET_NODE_MAP_ITEM(
    display: TDisplayType,
    originalSceneNodeId: string,
    copiedSceneNodeId: string,
  ) {
    this.state.nodeMaps[display] = {
      ...this.state.nodeMaps[display],
      [originalSceneNodeId]: copiedSceneNodeId,
    };
  }

  // setDisplayContexts(displays: TDisplayType[]) {
  //   return displays.reduce((successful: boolean, display: TDisplayType, index: number) => {
  //     if (index === 0) {
  //       // if it's the first context
  //       this.setSceneItemsOutput(display, false);
  //     } else {
  //       this.setSceneItemsOutput(display, true);
  //     }
  //     return successful;
  //   }, true);
  // }

  // setSceneItemsOutput(display: TDisplayType, copy: boolean = false) {
  //   const scene = this.scenesService.views.activeScene;

  //   if (!scene) return false;

  //   if (copy) {
  //     // copy nodes

  //     const nodesToCopy = scene.getSelection().selectAll();

  //     const horizontalCopyNodesCommand = new CopyNodesCommand(
  //       nodesToCopy,
  //       this.scenesService.views.activeScene.id,
  //     );
  //     const nodeMap = horizontalCopyNodesCommand.execute();
  //     // set node map for source selector
  //     console.log('nodeMap ', nodeMap);
  //     this.SET_NODE_MAP(display, horizontalCopyNodesCommand.idsMap);
  //   } else {
  //     scene.getItems().forEach(sceneItem => {
  //       sceneItem.output = this.videoSettingsService.contexts[display];
  //     });
  //   }

  //   return true;
  // }

  // resetSceneItemsOutput(display: TDisplayType = 'default') {}

  // @mutation()
  // private SET_NODE_MAP(display: TDisplayType = 'default', nodeMap?: Dictionary<string>) {
  //   this.state.nodeMaps[display] = nodeMap ?? null;
  // }

  //   createOutputNodes(displays: TDisplayType[], sceneId?: string) {
  //     return displays.reduce((created: boolean, display: TDisplayType) => {
  //       const contextEstablished = this.videoSettingsService.establishVideoContext(display);
  //       const sceneCreated = this.createDualOutputScene(display, sceneId);

  //       if (!contextEstablished || !sceneCreated) {
  //         created = false;
  //       }

  //       return created;
  //     }, true);
  //   }

  //   createDualOutputScene(display: TDisplayType, changedSceneId?: string) {
  //     const scene = this.createOutputSceneNode(display, changedSceneId);
  //     if (!scene) return false;

  //     this.SET_DUAL_OUTPUT_SCENE(display, scene);

  //     const sceneName = `${display}Scene`;
  //     return !!this.state[sceneName];
  //   }

  //   createOutputSceneNode(display: TDisplayType, changedSceneId?: string) {
  //     const sceneId = changedSceneId ?? this.scenesService.views.activeSceneId;
  //     const scene = obs.SceneFactory.fromName(sceneId);

  //     // if obs does not return a scene, we cannot add sources
  //     if (!scene) return null;

  //     const obsSceneItems = scene.getItems();

  //     obsSceneItems.forEach(sceneItem => {
  //       // create source using input factory
  //       // const source = obs.InputFactory.create(
  //       //   sceneItem.source.id,
  //       //   sceneItem.source.name,
  //       //   sceneItem.source.settings,
  //       // );

  //       const source = sceneItem.source;
  //       const contextSceneItem = scene.add(source);

  //       contextSceneItem.video = this.videoSettingsService.contexts[display];

  //       // @@@ TODO: set scene item settings according to persisted settings. For now, just set to visible
  //       sceneItem.visible = true;
  //     });

  //     return scene;
  //   }

  //   destroyOutputScenes(displays: TDisplayType[]) {
  //     // destroy contexts and scenes
  //     const destroyed = displays.reduce((destroyed: boolean, display: TDisplayType) => {
  //       const contextDestroyed = this.videoSettingsService.destroyVideoContext(display);
  //       const sceneReset = this.resetScene(display);

  //       if (!contextDestroyed || !sceneReset) {
  //         destroyed = false;
  //       }

  //       return destroyed;
  //     }, true);

  //     // in order for the default context to show a scene in single output mode
  //     // we need to add input sources onto a scene for the default context
  //     if (destroyed) {
  //       const context = this.videoSettingsService.contexts.default;

  //       // the default context is created on startup so there should always be a default context
  //       // the below is just a safeguard against errors from possible issues with the default context
  //       if (!context) {
  //         this.videoSettingsService.establishVideoContext('default');
  //       }
  //       const scene = this.createOutputSceneNode('default');
  //       // const scene = this.resetSceneFromActiveScene();

  //       return !!scene;
  //     } else {
  //       // if the scenes were not destroyed successfully, prevent dual output from toggling off
  //       return false;
  //     }
  //   }

  //   resetScene(display: TDisplayType) {
  //     const sceneName = `${display}Scene`;
  //     const scene: obs.IScene = this.state[sceneName];

  //     // if there is no scene, it has already been destroyed or was not created correctly
  //     // this prevents an error being thrown when attempting to get items
  //     if (!scene) return true;

  //     // const obsSceneItems = scene.getItems();
  //     // obsSceneItems.forEach((sceneItem: obs.ISceneItem) => {
  //     // sceneItem.source.release();
  //     // sceneItem.remove();
  //     // });
  //     scene.release();

  //     this.RESET_SCENE(display);

  //     return !this.state[sceneName];
  //   }

  //   resetSceneFromActiveScene() {
  //     const scene = this.scenesService.views
  //       .getScene(this.scenesService.views.activeSceneId)
  //       .getObsScene();

  //     if (!scene) return false;

  //     const obsSceneItems = scene.getItems();

  //     obsSceneItems.forEach(sceneItem => {
  //       // create source using input factory
  //       const source = obs.InputFactory.create(
  //         sceneItem.source.id,
  //         sceneItem.source.name,
  //         sceneItem.source.settings,
  //       );

  //       scene.add(source);
  //       sceneItem.video = this.videoSettingsService.contexts['default'];

  //       // @@@ TODO: set scene item settings according to persisted settings. For now, just set to visible
  //       sceneItem.visible = true;
  //     });
  //   }

  //   shutdown() {
  //     if (this.state.dualOutputMode) {
  //       try {
  //         this.destroyOutputScenes(['horizontal', 'vertical']);
  //       } catch (error: unknown) {
  //         console.error('Error shutting down Dual Output Service ', error);
  //       }
  //     }
  //   }

  updatePlatformSetting(platform: EDualOutputPlatform | string, setting: TDualOutputDisplayType) {
    this.UPDATE_PLATFORM_SETTING(platform, setting);
  }

  @mutation()
  private UPDATE_PLATFORM_SETTING(
    platform: EDualOutputPlatform | string,
    setting: TDualOutputDisplayType,
  ) {
    this.state.platformSettings[platform] = {
      ...this.state.platformSettings[platform],
      setting,
    };
  }

  //   @mutation()
  //   private SET_DUAL_OUTPUT_SCENE(display: TDisplayType, scene: obs.IScene) {
  //     this.state[`${display}Scene`] = scene;
  //   }

  //   @mutation()
  //   private RESET_SCENE(display: TDisplayType) {
  //     this.state[`${display}Scene`] = null as obs.IScene;
  //   }

  //   attachNodesToMap(nodes: TSceneNode[], nodeMap: Dictionary<string>) {
  //     return nodes.reduce((mappedNodes, node) => {
  //       const id = Object.keys(nodeMap).find(key => nodeMap[key] === node.id);
  //       return { ...mappedNodes, [id]: { [node.id]: node } };
  //     }, {});
  //   }

  //   setNodeMap(sceneId: string, nodeMap: Dictionary<string>) {
  //     this.SET_NODE_MAP(sceneId, nodeMap);
}

///////////////////////////////////////////////////////////////////////////////////////////////////////

// destroyDualOutputScenes() {
//   if (this.views.hasDualOutputScenes) {
// remove dual output scenes
// this.scenesService.removeScene(this.state.horizontalSceneId, true);
// this.scenesService.removeScene(this.state.verticalSceneId, true);
// reset data for dual output scenes
//   this.resetDualOutputDisplays();
// }
// @@@ TODO: remove all scene items on scenes before releasing scene
// }

// resetDualOutputDisplays() {
//   // this.REMOVE_DUAL_OUTPUT_SCENES();
//   this.RESET_NODE_MAPS();
// }

// @mutation()
// private REMOVE_DUAL_OUTPUT_SCENES() {
//   this.state.horizontalSceneId = null;
//   this.state.verticalSceneId = null;
// }

// @mutation()
// private SET_DUAL_OUTPUT_SCENES(horizontalSceneId: string, verticalSceneId: string) {
//   this.state.horizontalSceneId = horizontalSceneId;
//   this.state.verticalSceneId = verticalSceneId;
// }

// async setDualOutputScenes(sceneId: string) {
//   if (this.views.hasDualOutputScenes) {
//     // For performance, we only want one set of dual output scenes active at any time
//     // so when the user changes the active scene, we destroy the dual output scenes.

//     // Determine if this is a change in the active scene
//     // We only need to check one of the dual output scene ids
//     // because they are created at the same time from the same active scene.
//     const lastIndex = this.state.horizontalSceneId.lastIndexOf('_');
//     this.state.horizontalSceneId.slice(0, lastIndex - 2);
//     const currentSceneId = this.state.horizontalSceneId.slice(0, lastIndex - 2);

//     if (currentSceneId === sceneId) {
//       return;
//     } else {
//       this.destroyDualOutputScenes();
//     }
//   }

//   // get active scene nodes
//   const activeScene = this.scenesService.views.getScene(sceneId);
//   console.log('activeScene ', activeScene.getObsScene());
//   const nodesToCopy = activeScene.getSelection().selectAll();

//   // create scenes
//   const horizontalScene = this.scenesService.createScene(`${sceneId}_horizontal`, {
//     duplicateSourcesFromScene: activeScene.id,
//     sceneId: `${sceneId}_horizontal`,
//     makeActive: false,
//   });
//   const verticalScene = this.scenesService.createScene(`${sceneId}_vertical`, {
//     duplicateSourcesFromScene: activeScene.id,
//     sceneId: `${sceneId}_vertical`,
//     makeActive: false,
//   });

//   console.log('horizontalScene ', horizontalScene.getObsScene());
//   console.log('verticalScene ', verticalScene.getObsScene());

//   /**
//    * @@@ TODO: determine how different sources are or are not shared
//    * to determine if the dual output scenes need to have their own sources created for certain scene items
//    */

//   // copy nodes from active scene
//   const horizontalCopyNodesCommand = new CopyNodesCommand(nodesToCopy, horizontalScene.state.id);
//   horizontalCopyNodesCommand.execute();
//   const verticalCopyNodesCommand = new CopyNodesCommand(nodesToCopy, verticalScene.state.id);
//   verticalCopyNodesCommand.execute();

//   // update state
//   this.SET_NODE_MAPS(horizontalCopyNodesCommand.idsMap, verticalCopyNodesCommand.idsMap);

//   if (!this.state.dualOutputMode && this.videoSettingsService.additionalContextsExist) {
//     this.TOGGLE_DUAL_OUTPUT_MODE(true);
//   }
//   this.SET_DUAL_OUTPUT_SCENES(horizontalScene.state.id, verticalScene.state.id);
// }

// @@@ TODO: map nodes
//   @mutation()
//   private SET_NODE_MAPS(
//     horizontalNodeMap?: Dictionary<string>,
//     verticalNodeMap?: Dictionary<string>,
//   ) {
//     if (!horizontalNodeMap || !verticalNodeMap) {
//       this.state.horizontalNodeMap = null;
//       this.state.verticalNodeMap = null;
//     } else {
//       this.state.horizontalNodeMap = horizontalNodeMap;
//       this.state.verticalNodeMap = verticalNodeMap;
//     }
//   }

//   @mutation()
//   private RESET_NODE_MAPS() {
//     this.state.horizontalNodeMap = null;
//     this.state.verticalNodeMap = null;
//   }

//   @mutation()
//   private SET_NODE_MAP(sceneId: string, nodeMap: Dictionary<string>) {
//     const display = sceneId.split('_').pop();

//     if (Object.values<string>(EOutputDisplayType).includes(display)) {
//       this.state[`${display}NodeMap`] = nodeMap;
//     }
//   }
// }
