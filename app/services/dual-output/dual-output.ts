import { PersistentStatefulService, InitAfter, Inject, ViewHandler, mutation } from 'services/core';
import {
  TDualOutputPlatformSettings,
  DualOutputPlatformSettings,
  IDualOutputDestinationSetting,
} from './dual-output-data';
import { verticalDisplayData } from '../settings-v2/default-settings-data';
import {
  ScenesService,
  SceneItem,
  TSceneNode,
  Scene,
  IScene,
  SceneItemNode,
} from 'services/scenes';
import { TDisplayType, VideoSettingsService } from 'services/settings-v2/video';
import { TPlatform } from 'services/platforms';
import { EPlaceType } from 'services/editor-commands/commands/reorder-nodes';
import { EditorCommandsService } from 'services/editor-commands';
import { Subject } from 'rxjs';
import { TOutputOrientation } from 'services/restream';
import { IVideoInfo } from 'obs-studio-node';
import { ICustomStreamDestination, StreamSettingsService } from 'services/settings/streaming';
import {
  ISceneCollectionsManifestEntry,
  SceneCollectionsService,
} from 'services/scene-collections';
import { UserService } from 'services/user';
import { SelectionService, Selection } from 'services/selection';
import { StreamingService } from 'services/streaming';
import { SettingsService } from 'services/settings';
import { RunInLoadingMode } from 'services/app/app-decorators';
import { compact } from 'lodash';

interface IDisplayVideoSettings {
  horizontal: IVideoInfo;
  vertical: IVideoInfo;
  activeDisplays: {
    horizontal: boolean;
    vertical: boolean;
  };
}
interface IDualOutputServiceState {
  platformSettings: TDualOutputPlatformSettings;
  destinationSettings: Dictionary<IDualOutputDestinationSetting>;
  dualOutputMode: boolean;
  videoSettings: IDisplayVideoSettings;
  isLoading: boolean;
}

class DualOutputViews extends ViewHandler<IDualOutputServiceState> {
  @Inject() private scenesService: ScenesService;
  @Inject() private videoSettingsService: VideoSettingsService;
  @Inject() private sceneCollectionsService: SceneCollectionsService;
  @Inject() private streamingService: StreamingService;

  get isLoading(): boolean {
    return this.state.isLoading;
  }

  get activeSceneId(): string {
    return this.scenesService.views.activeSceneId;
  }

  get dualOutputMode(): boolean {
    return this.state.dualOutputMode;
  }

  get activeCollection(): ISceneCollectionsManifestEntry {
    return this.sceneCollectionsService.activeCollection;
  }

  get isDualOutputCollection(): boolean {
    // console.log('this.activeCollection ', this.activeCollection);
    return !!this.activeCollection?.sceneNodeMaps;
  }

  get sceneNodeMaps(): { [sceneId: string]: Dictionary<string> } {
    return this.activeCollection?.sceneNodeMaps || {};
  }

  get activeSceneNodeMap(): Dictionary<string> {
    return this.sceneCollectionsService?.sceneNodeMaps?.[this.activeSceneId];
  }

  /**
   * Confirm that an entry exists in the scene collections manifest's scene node map property
   */
  get hasVerticalNodes() {
    return !!this.sceneNodeMaps[this.activeSceneId];
  }

  /**
   * Determines if there are any node maps in the scene collections scene node map property in the
   * scene collections manifest. The existence of the node map in the scene collections manifest
   * shows that the scene collection has been converted to a dual output scene collection. To prevent
   * undefined or null errors from unexpected behavior, confirm that there are any entries in the
   * collection's scene node maps property.
   *
   * Also check to see if dual output mode is active so that a new scene created in dual output mode
   * will correctly create item and show display toggles.
   */
  get hasSceneNodeMaps(): boolean {
    const nodeMaps = this.sceneCollectionsService?.sceneNodeMaps;
    return this.dualOutputMode || (!!nodeMaps && Object.entries(nodeMaps).length > 0);
  }

  get platformSettings() {
    return this.state.platformSettings;
  }

  get destinationSettings() {
    return this.state.destinationSettings;
  }

  get horizontalNodeIds(): string[] {
    if (!this.activeSceneNodeMap) return;

    return Object.keys(this.activeSceneNodeMap);
  }

  get verticalNodeIds(): string[] {
    if (!this.activeSceneNodeMap) return;

    return Object.values(this.activeSceneNodeMap);
  }

  get videoSettings() {
    return this.state.videoSettings;
  }

  get activeDisplays() {
    return this.state.videoSettings.activeDisplays;
  }

  get showHorizontalDisplay() {
    return !this.state.dualOutputMode || (this.activeDisplays.horizontal && !this.state.isLoading);
  }

  get showVerticalDisplay() {
    return this.state.dualOutputMode && this.activeDisplays.vertical && !this.state.isLoading;
  }

  get onlyVerticalDisplayActive() {
    return this.activeDisplays.vertical && !this.activeDisplays.horizontal;
  }

  getPlatformDisplay(platform: TPlatform) {
    return this.state.platformSettings[platform].display;
  }

  getPlatformContext(platform: TPlatform) {
    const display = this.getPlatformDisplay(platform);
    return this.videoSettingsService.state[display];
  }

  getPlatformMode(platform: TPlatform): TOutputOrientation {
    const display = this.getPlatformDisplay(platform);
    if (!display) return 'landscape';
    return display === 'horizontal' ? 'landscape' : 'portrait';
  }

  getMode(display?: TDisplayType): TOutputOrientation {
    if (!display) return 'landscape';
    return display === 'horizontal' ? 'landscape' : 'portrait';
  }

  getHorizontalNodeId(verticalNodeId: string, sceneId?: string) {
    const sceneNodeMap = sceneId ? this.sceneNodeMaps[sceneId] : this.activeSceneNodeMap;
    if (!sceneNodeMap) return;

    return Object.keys(sceneNodeMap).find(
      (horizontalNodeId: string) => sceneNodeMap[horizontalNodeId] === verticalNodeId,
    );
  }

  getVerticalNodeId(horizontalNodeId: string, sceneId?: string): string {
    const sceneNodeMap = sceneId ? this.sceneNodeMaps[sceneId] : this.activeSceneNodeMap;
    if (!sceneNodeMap) return;

    return Object.values(sceneNodeMap).find(
      (verticalNodeId: string) => sceneNodeMap[horizontalNodeId] === verticalNodeId,
    );
  }

  getDualOutputNodeId(nodeId: string, sceneId?: string) {
    return this.getHorizontalNodeId(nodeId, sceneId) ?? this.getVerticalNodeId(nodeId, sceneId);
  }

  getVerticalNodeIds(sceneId: string): string[] {
    if (!this.sceneNodeMaps[sceneId]) return;

    return Object.values(this.sceneNodeMaps[sceneId]);
  }

  getNodeDisplay(nodeId: string, sceneId: string) {
    const sceneNodeMap = sceneId ? this.sceneNodeMaps[sceneId] : this.activeSceneNodeMap;

    if (sceneNodeMap && Object.values(sceneNodeMap).includes(nodeId)) {
      return 'vertical';
    }

    // return horizontal by default because if the sceneNodeMap doesn't exist
    // dual output has never been toggled on with this scene active
    return 'horizontal';
  }

  getPlatformContextName(platform?: TPlatform): TOutputOrientation {
    return this.getPlatformDisplay(platform) === 'horizontal' ? 'landscape' : 'portrait';
  }

  getDisplayContextName(display: TDisplayType): TOutputOrientation {
    return display === 'horizontal' ? 'landscape' : 'portrait';
  }

  /**
   * Get the visibility for the vertical node.
   * @remark Primarily used for the source toggles. The id of the node is determined either by the
   * @param nodeId
   * @param sceneId
   * @returns
   */
  getIsHorizontalVisible(nodeId: string, sceneId?: string) {
    if (!this.hasVerticalNodes) return false;
    return this.scenesService.views.getNodeVisibility(nodeId, sceneId ?? this.activeSceneId);
  }

  /**
   * Get the visibility for the vertical node.
   * @remark Primarily used for the source toggles. The id of the node is determined either by the
   * @param nodeId
   * @param sceneId
   * @returns
   */
  getIsVerticalVisible(nodeId: string, sceneId?: string) {
    // in the source selector, the vertical node id is determined by the visible display
    if (!this.hasVerticalNodes) return false;

    const id =
      this.activeDisplays.vertical && !this.activeDisplays.horizontal
        ? nodeId
        : this.activeSceneNodeMap[nodeId];

    return this.scenesService.views.getNodeVisibility(id, sceneId ?? this.activeSceneId);
  }

  getCanStreamDualOutput() {
    const platformDisplays = this.streamingService.views.activeDisplayPlatforms;
    const destinationDisplays = this.streamingService.views.activeDisplayDestinations;

    const horizontalHasDestinations =
      platformDisplays.horizontal.length > 0 || destinationDisplays.horizontal.length > 0;
    const verticalHasDestinations =
      platformDisplays.vertical.length > 0 || destinationDisplays.vertical.length > 0;

    return horizontalHasDestinations && verticalHasDestinations;
  }

  /**
   * Confirm if a scene has a node map for dual output.
   * @remark If the scene collection does not have the scene node maps property in the
   * scene collection manifest, this will return false.
   * @param sceneId Optional id of the scene to look up. If no scene id is provided, the active
   * scene's id will be used.
   * @returns Boolean for whether or not the scene has an entry in the scene collections scene node map.
   */
  hasNodeMap(sceneId?: string): boolean {
    if (!this.sceneCollectionsService?.sceneNodeMaps) return false;
    const nodeMap = sceneId ? this.sceneNodeMaps[sceneId] : this.activeSceneNodeMap;
    return !!nodeMap && Object.keys(nodeMap).length > 0;
  }
}

@InitAfter('ScenesService')
export class DualOutputService extends PersistentStatefulService<IDualOutputServiceState> {
  @Inject() private scenesService: ScenesService;
  @Inject() private videoSettingsService: VideoSettingsService;
  @Inject() private sceneCollectionsService: SceneCollectionsService;
  @Inject() private streamSettingsService: StreamSettingsService;
  @Inject() private userService: UserService;
  @Inject() private selectionService: SelectionService;
  @Inject() private streamingService: StreamingService;
  @Inject() private settingsService: SettingsService;

  static defaultState: IDualOutputServiceState = {
    platformSettings: DualOutputPlatformSettings,
    destinationSettings: {},
    dualOutputMode: false,
    videoSettings: {
      horizontal: null,
      vertical: verticalDisplayData, // get settings for horizontal display from obs directly
      activeDisplays: {
        horizontal: true,
        vertical: false,
      },
    },
    isLoading: false,
  };

  sceneNodeHandled = new Subject<number>();

  get views() {
    return new DualOutputViews(this.state);
  }

  init() {
    super.init();

    // confirm custom destinations have a default display
    this.confirmDestinationDisplays();

    /**
     * When a dual output collection is loaded, we need to confirm the scene node maps are accurate and repair
     * the scene collection if necessary. This is to prevent any potential undefined errors or issues
     * with nodes not having a partner.
     */
    this.scenesService.sceneSwitched.subscribe((scene: IScene) => {
      // if a scene collection is added in dual output mode, automatically add the
      // scene collection as a dual output scene collection
      console.log('this.views.isDualOutputCollection ', this.views.isDualOutputCollection);
      if (!this.views.isDualOutputCollection) {
        // console.log('vanilla collection when switched');
        if (this.state.dualOutputMode) {
          // console.log('creating, dual output mode');
          this.createSceneNodes(scene.id);
          return;
        } else {
          // if we're not in dual output mode and there is no scene node map
          // it is a vanilla scene collection, so there is no need to confirm the nodes
          // console.log('returning');
          return;
        }
      } else {
        // console.log('dual output collection when switcghe');
        // if there is no scene node map, this is a scene in a dual output scene collection
        // that has not yet been converted to a dual output scene
        // so create a node map for the scene if one does not already exist
        if (!this.views?.activeSceneNodeMap) {
          this.createSceneNodes(scene.id);
        } else {
          // if the scene has a node map, it is a dual output collection,
          // so confirm:
          // 1. all vertical nodes in the map have a partner
          // 3. all nodes are ordered correctly in the scene
          this.confirmSceneNodeMaps();

          // this.confirmSceneNodeOrder();
          // this.confirmSceneSources();
        }
      }
    });

    /**
     * The user must be logged in to use dual output mode
     * so toggle off dual output mode on log out.
     */
    this.userService.userLogout.subscribe(() => {
      if (this.state.dualOutputMode) {
        this.setdualOutputMode();
      }
    });
  }

  /**
   * Edit dual output display settings
   */

  @RunInLoadingMode()
  setdualOutputMode(status?: boolean) {
    if (!this.userService.isLoggedIn) return;

    this.SET_SHOW_DUAL_OUTPUT(status);

    if (this.state.dualOutputMode) {
      this.confirmOrCreateVerticalNodes(this.views.activeSceneId);

      /**
       * Selective recording only works with horizontal sources, so don't show the
       * vertical display if toggling with selective recording active
       */
      if (!this.streamingService.state.selectiveRecording) {
        this.toggleDisplay(true, 'vertical');
      }
    } else {
      this.selectionService.views.globalSelection.reset();
    }

    this.settingsService.showSettings('Video');
  }

  /**
   * Create or confirm nodes for vertical output when toggling vertical display
   * @param sceneId - Id of the scene to map
   */
  confirmOrCreateVerticalNodes(sceneId: string) {
    this.convertSceneSources(sceneId);
    if (!this.views.hasNodeMap(sceneId) && this.state.dualOutputMode) {
      try {
        console.log('creating');
        this.createSceneNodes(sceneId);
      } catch (error: unknown) {
        console.error('Error toggling Dual Output mode: ', error);
      }
    } else {
      try {
        console.log('confirming');
        this.confirmOrAssignSceneNodes(sceneId);
      } catch (error: unknown) {
        console.error('Error toggling Dual Output mode: ', error);
      }
    }
  }

  convertSceneSources(sceneId: string) {
    const sceneSources = this.scenesService.views.sceneSourcesForScene(sceneId);
    if (sceneSources.length > 0) {
      sceneSources.forEach(scene => this.confirmOrCreateVerticalNodes(scene.sourceId));
    }
  }

  /**
   * Assign or confirm node contexts to a dual output scene
   * @param sceneId - Id of the scene to map
   */
  confirmOrAssignSceneNodes(sceneId: string) {
    this.SET_IS_LOADING(true);
    const sceneNodes = this.scenesService.views.getSceneNodesBySceneId(sceneId);
    if (!sceneNodes) return;

    const verticalNodeIds = new Set(this.views.getVerticalNodeIds(sceneId));

    // establish vertical context if it doesn't exist
    if (
      this.views.getVerticalNodeIds(sceneId)?.length > 0 &&
      !this.videoSettingsService.contexts.vertical
    ) {
      this.videoSettingsService.establishVideoContext('vertical');
    }

    sceneNodes.forEach((sceneItem: TSceneNode, index: number) => {
      // Item already has a context assigned
      // Folders do not have contexts assigned
      if (sceneItem.isFolder() || sceneItem?.output) return;

      const display = verticalNodeIds?.has(sceneItem.id) ? 'vertical' : 'horizontal';
      this.assignNodeContext(sceneItem, sceneItem?.display ?? display);
      this.sceneNodeHandled.next(index);
    });
    this.SET_IS_LOADING(false);
  }

  createSceneNodes(sceneId: string) {
    this.SET_IS_LOADING(true);
    // establish vertical context if it doesn't exist
    if (this.state.dualOutputMode && !this.videoSettingsService.contexts.vertical) {
      this.videoSettingsService.establishVideoContext('vertical');
    }

    // the reordering of the nodes below is replicated from the copy nodes command
    const scene = this.scenesService.views.getScene(sceneId);
    const nodes = scene.getNodes();
    const initialNodeOrder = scene.getNodesIds();
    const nodeIdsMap: Dictionary<string> = {};

    nodes.forEach((node, index) => {
      const verticalNodeId = this.createVerticalNode(node);
      nodeIdsMap[node.id] = verticalNodeId;
      this.sceneNodeHandled.next(index);
    });

    const order = compact(scene.getNodesIds().map(origNodeId => nodeIdsMap[origNodeId]));
    scene.setNodesOrder(order.concat(initialNodeOrder));
    this.SET_IS_LOADING(false);
  }

  // createSceneNodes(sceneId: string) {
  //   this.SET_IS_LOADING(true);
  //   // establish vertical context if it doesn't exist
  //   if (this.state.dualOutputMode && !this.videoSettingsService.contexts.vertical) {
  //     this.videoSettingsService.establishVideoContext('vertical');
  //   }

  //   const scene = this.scenesService.views.getScene(sceneId);
  //   const nodes = scene.getNodes();
  //   const horizontalNodesOrder = scene.getNodesIds();

  //   console.log('horizontalNodesOrder ', horizontalNodesOrder);

  //   // const insertedNodes: TSceneNode[] = [];
  //   // const nodeIdsMap: string[] = [];

  //   // this.editorCommandsService.executeCommand(
  //   //   'CopyNodesCommand',
  //   //   this.scenesService.views.getScene(sceneId).getSelection(nodes),
  //   //   sceneId,
  //   //   false,
  //   //   'vertical',
  //   // );
  //   nodes.forEach(node => {
  //     // for vanilla scene collections, all scene nodes should have
  //     // a display of horizontal assigned on load
  //     // handle possibilities for this not being the case
  //     if (!node?.display || node?.display === 'vertical') {
  //       node.setDisplay('horizontal');
  //     }

  //     this.createVerticalNode(node);
  //     // insertedNodes.push(verticalNode);
  //   });

  //   // order the nodes
  //   const verticalNodesOrder = compact(
  //     horizontalNodesOrder.map(horizontalNodeId => this.views.activeSceneNodeMap[horizontalNodeId]),
  //   );

  //   console.log('verticalNodesOrder ', verticalNodesOrder);

  //   scene.setNodesOrder(horizontalNodesOrder.concat(verticalNodesOrder));

  //   this.SET_IS_LOADING(false);
  // }

  /**
   * Copy node or assign node context
   * @remark Currently, only the widget service needs to confirm the display,
   * all other function calls are to copy the horizontal node to a vertical node
   * @param sceneItem - the scene item to copy or assign context
   * @param display - the name of the context, which is also the display name
   * @param isHorizontalDisplay - whether this is the horizontal or vertical display
   * @param sceneId - the scene id where a copied node should be added, default is the active scene id
   * @returns
   */
  createOrAssignOutputNode(
    sceneItem: SceneItem,
    display: TDisplayType,
    isHorizontalDisplay: boolean,
    sceneId?: string,
    verticalNodeId?: string,
  ): SceneItem {
    // @@@ TODO: scene source
    if (sceneItem.type === 'scene') {
      this.confirmOrCreateVerticalNodes(sceneItem.sourceId);
    }

    if (isHorizontalDisplay) {
      // if it's the first display, just assign the scene item's output to a context
      this.assignNodeContext(sceneItem, display);
      return sceneItem;
    } else {
      // if it's not the first display, copy the scene item
      const scene = this.scenesService.views.getScene(sceneId ?? this.views.activeSceneId);
      const copiedSceneItem = scene.addSource(sceneItem.sourceId, { id: verticalNodeId, display });

      if (!copiedSceneItem) return null;

      const selection = scene.getSelection(copiedSceneItem.id);
      this.reorderDualOutputNode(selection, sceneItem.id);

      this.sceneCollectionsService.createNodeMapEntry(sceneId, sceneItem.id, copiedSceneItem.id);
      return copiedSceneItem;
    }
  }

  reorderDualOutputNode(selection: Selection, horizontalNodeId: string) {
    /* The order of the nodes in a dual output scene collection is all the horizontal nodes first
       and then all of the vertical display nodes. So the structure looks like:

          Item1: color_source    <-- horizontal
          Item2: color_source    <-- horizontal
          Folder1                <-- horizontal
            Item3: color_source  <-- horizontal
            Item4: color_source  <-- horizontal
          Item5: color_source    <-- horizontal
          Item1: color_source    <-- vertical display
          Item2: color_source    <-- vertical display
          Folder1                <-- vertical display
            Item3: color_source  <-- vertical display
            Item4: color_source  <-- vertical display
          Item5: color_source    <-- vertical display

       To maintain the correct order, find the horizontal node's vertical partner to place before
       If there is no corresponding vertical node, create it.
       */

    let verticalNodeId = this.views.getVerticalNodeId(horizontalNodeId);

    if (!verticalNodeId) {
      const horizontalNode = this.scenesService.views.getSceneItem(horizontalNodeId);
      verticalNodeId = this.createVerticalNode(horizontalNode);
    }

    selection.placeAfter(verticalNodeId);
  }

  /*
   * Assign context to a node if it does not already have one
   */
  assignNodeContext(node: TSceneNode, display: TDisplayType) {
    if (node.isItem()) {
      const context = this.videoSettingsService.contexts[display];
      if (!context) return null;
      node.setSettings({ output: context, display });
    } else {
      // because folders just group scene items, they do not have their own output value
      // set the display for toggling in the source selector
      node.setDisplay(display);
    }

    return node.id;
  }

  /**
   * Create a horizontal node to partner with the vertical node
   * @param verticalNode - Node to copy to the horizontal display
   *
   * @remark The horizontal node id is always the key in the scene node map.
   * The node map entry is so that the horizontal and vertical nodes can refer to each other.
   */
  createHorizontalNode(verticalNode: TSceneNode): string {
    const scene = verticalNode.getScene();

    if (verticalNode.isFolder()) {
      // add folder and create node map entry
      const folder = scene.createFolder(verticalNode.name, { display: 'horizontal' });
      folder.placeBefore(verticalNode.id);

      this.sceneCollectionsService.createNodeMapEntry(scene.id, folder.id, verticalNode.id);

      // make sure node is correctly nested
      if (verticalNode.parentId) {
        const horizontalNodeParentId = this.views.getHorizontalNodeId(verticalNode.parentId);
        if (!horizontalNodeParentId) return;
        folder.setParent(horizontalNodeParentId);
      }

      folder.placeBefore(verticalNode.id);

      return folder.id;
    } else {
      // add item
      const item = scene.addSource(verticalNode.sourceId, {
        display: 'horizontal',
      });

      if (verticalNode.parentId) {
        const horizontalNodeParentId = this.views.getHorizontalNodeId(verticalNode.parentId);
        if (!horizontalNodeParentId) return;
        item.setParent(horizontalNodeParentId);
      }
      item.placeBefore(verticalNode.id);

      // match values
      item.setVisibility(verticalNode.visible);
      item.setLocked(verticalNode.locked);

      this.sceneCollectionsService.createNodeMapEntry(scene.id, item.id, verticalNode.id);

      return item.id;
    }
  }

  /**
   * Create a vertical node to partner with the vertical node
   * @param horizontalNode - Node to copy to the vertical display
   *
   * @remark The horizontal node id is always the key in the scene node map.
   * The node map entry is so that the horizontal and vertical nodes can refer to each other.
   */
  createVerticalNode(horizontalNode: TSceneNode, isSceneSourceNode: boolean = false): string {
    const scene = horizontalNode.getScene();

    if (horizontalNode.isFolder()) {
      // add folder and create node map entry
      const folder = scene.createFolder(horizontalNode.name, { display: 'vertical' });
      this.setNodeMapEntry(scene, horizontalNode.id, folder.id, isSceneSourceNode);

      // make sure node is correctly nested
      if (horizontalNode.parentId) {
        const verticalNodeParentId = this.views.activeSceneNodeMap[horizontalNode.parentId];
        if (!verticalNodeParentId) return;
        folder.setParent(verticalNodeParentId);
      } else {
        folder.placeAfter(horizontalNode.id);
      }

      return folder.id;
    } else {
      // add item
      const item = scene.addSource(horizontalNode.sourceId, {
        display: 'vertical',
      });

      // make sure node is correctly nested
      if (horizontalNode.parentId) {
        const verticalNodeParentId = this.views.activeSceneNodeMap[horizontalNode.parentId];
        if (!verticalNodeParentId) return;
        item.setParent(verticalNodeParentId);
      } else {
        item.placeAfter(horizontalNode.id);
      }

      // nodes created for the vertical display are transformed so that they are easily accessible in the vertical display
      // nodes created to render scene sources in the vertical display are not because they are intended to be exact copies
      // of the horizontal nodes
      if (!isSceneSourceNode) {
        // position all of the nodes in the upper left corner of the vertical display
        // so that all of the sources are visible
        item.setTransform({ position: { x: 0, y: 0 } });

        // show all vertical scene items by default
        item.setVisibility(true);

        // match locked
        item.setLocked(horizontalNode.locked);

        // make sure node is correctly nested
        if (horizontalNode.parentId) {
          const verticalNodeParentId = this.views.activeSceneNodeMap[horizontalNode.parentId];
          if (!verticalNodeParentId) return;
          item.setParent(verticalNodeParentId);
        }
      }

      return item.id;
    }
  }

  /**
   * Confirm the scene's node map
   * @remark Primarily used when switching scenes
   */
  confirmSceneNodeMaps() {
    this.SET_IS_LOADING(true);
    // establish vertical context if it doesn't exist
    if (!this.videoSettingsService.contexts.vertical) {
      this.videoSettingsService.establishVideoContext('vertical');
    }

    const sceneNodeMaps = this.views?.sceneNodeMaps;

    // confirm nodes and map for each scene that has been converted to a dual output scene
    for (const sceneId in sceneNodeMaps) {
      const nodeMap = sceneNodeMaps[sceneId];

      const sceneNodes = this.scenesService.views.getSceneNodesBySceneId(sceneId);
      if (!sceneNodes) return;

      // track node order to confirm order of nodes in the scene matches the expected order
      // after the node map has been confirmed
      const horizontalNodeOrder: string[] = [];
      const verticalNodeOrder: string[] = [];

      // the keys in the nodemap are the ids for the horizontal nodes
      const keys = Object.keys(nodeMap);
      const horizontalNodeIds = new Set(keys);
      // the values in the nodemap are the ids for the vertical nodes
      const values = Object.values(nodeMap);
      const verticalNodeIds = new Set(values);

      // confirm node map
      sceneNodes.forEach((sceneNode: TSceneNode, index: number) => {
        if (sceneNode?.display === 'horizontal') {
          horizontalNodeOrder.push(sceneNode.id);

          let verticalNodeId = nodeMap[sceneNode.id];

          // confirm horizontal node has a partner vertical node
          if (!verticalNodeId) {
            // create vertical node and node map entry
            verticalNodeId = this.createVerticalNode(sceneNode);
            verticalNodeOrder.push(verticalNodeId);
          }

          // remove from keys because we have confirmed this entry
          horizontalNodeIds.delete(sceneNode.id);

          // confirm scene item has output, or assign one
          if (sceneNode?.output) return;
          this.assignNodeContext(sceneNode, 'horizontal');
        } else if (sceneNode?.display === 'vertical') {
          verticalNodeOrder.push(sceneNode?.id);

          // confirm horizontal node
          if (!verticalNodeIds.has(sceneNode.id)) {
            // create horizontal node and node map entry
            const horizontalNodeId = this.createHorizontalNode(sceneNode);
            // track order of horizontal nodes in scene
            horizontalNodeOrder.push(horizontalNodeId);
          }

          // confirm scene item has output, or assign one
          if (sceneNode?.output) return;
          this.assignNodeContext(sceneNode, 'vertical');
        } else {
          // otherwise assign it to the horizontal display and create a vertical node
          const horizontalNodeId = sceneNode?.id;
          this.assignNodeContext(sceneNode, 'horizontal');
          const verticalNodeId = this.createVerticalNode(sceneNode);

          // track order of nodes
          horizontalNodeOrder.push(horizontalNodeId);
          verticalNodeOrder.push(verticalNodeId);
        }
        this.sceneNodeHandled.next(index);
      });

      // after confirming all of the scene items, the Set of horizontal ids (or keys) should be empty
      // if there are any remaining values in the Set, these are incorrect entries in the scene node map
      // because they do not correspond to any node. To repair the scene node map, delete these incorrect entries.
      horizontalNodeIds.forEach((horizontalId: string) => {
        this.sceneCollectionsService.removeNodeMapEntry(horizontalId, sceneId);
      });

      // @@@ TODO
      // ensure that any source that is a scene has vertical nodes created
      // so that the scene source will correctly render in the vertical display
      // this.convertSceneSources(sceneId);
    }

    this.SET_IS_LOADING(false);
  }

  /**
   * Set entry in node map
   * @remark Distinguish between nodes created to render scene sources in the vertical display
   * and nodes created for the vertical display for the editor
   * @param scene - Scene, the scene for the entry
   * @param horizontalNodeId - string, the horizontal node id, to be used as a key
   * @param verticalNodeId - string, the vertical node id, to be used as a value
   * @param isSceneSourceNode - boolean, distinguish between nodes created for the vertical editor display
   * and nodes created to render a scene source in the vertical display
   */
  setNodeMapEntry(
    scene: Scene,
    horizontalNodeId: string,
    verticalNodeId: string,
    isSceneSourceNode: boolean = false,
  ) {
    if (isSceneSourceNode) {
      // scene.setSceneSourceNodeMapEntry(horizontalNodeId, verticalNodeId);
    } else {
      this.sceneCollectionsService.createNodeMapEntry(scene.id, horizontalNodeId, verticalNodeId);
    }
  }

  /**
   * Settings for platforms to displays
   */

  updatePlatformSetting(platform: string, display: TDisplayType) {
    this.UPDATE_PLATFORM_SETTING(platform, display);
  }

  updateDestinationSetting(destination: string, display?: TDisplayType) {
    this.UPDATE_DESTINATION_SETTING(destination, display);
  }

  /**
   * Confirm custom destinations have assigned displays
   */

  confirmDestinationDisplays() {
    const customDestinations = this.streamSettingsService.settings.goLiveSettings
      ?.customDestinations;
    if (!customDestinations) return;

    customDestinations.forEach((destination: ICustomStreamDestination, index: number) => {
      if (!destination.hasOwnProperty('display')) {
        const updatedDestinations = customDestinations.splice(index, 1, {
          ...destination,
          display: 'horizontal',
        });
        this.streamSettingsService.setGoLiveSettings({ customDestinations: updatedDestinations });
      }
    });
  }

  /**
   * Show/hide displays
   *
   * @param status - Boolean visibility of display
   * @param display - Name of display
   */
  toggleDisplay(status: boolean, display: TDisplayType) {
    this.SET_DISPLAY_ACTIVE(status, display);
  }

  /**
   * Update Video Settings
   */

  setVideoSetting(setting: Partial<IVideoInfo>, display?: TDisplayType) {
    this.SET_VIDEO_SETTING(setting, display);
  }

  updateVideoSettings(settings: IVideoInfo, display: TDisplayType = 'horizontal') {
    this.UPDATE_VIDEO_SETTING(settings, display);
  }

  setIsLoading(status: boolean) {
    this.SET_IS_LOADING(status);
  }

  /**
   * Update loading state to show loading animation
   */

  setIsCollectionOrSceneLoading(status: boolean) {
    this.SET_IS_LOADING(status);
  }

  @mutation()
  private UPDATE_PLATFORM_SETTING(platform: TPlatform | string, display: TDisplayType) {
    this.state.platformSettings = {
      ...this.state.platformSettings,
      [platform]: { ...this.state.platformSettings[platform], display },
    };
  }

  @mutation()
  private UPDATE_DESTINATION_SETTING(destination: string, display: TDisplayType = 'horizontal') {
    if (!this.state.destinationSettings[destination]) {
      // create setting
      this.state.destinationSettings = {
        ...this.state.destinationSettings,
        [destination]: {
          destination,
          display,
        },
      };
    } else {
      // update setting
      this.state.destinationSettings = {
        ...this.state.destinationSettings,
        [destination]: { ...this.state.destinationSettings[destination], display },
      };
    }
  }

  @mutation()
  private SET_SHOW_DUAL_OUTPUT(status?: boolean) {
    this.state = {
      ...this.state,
      dualOutputMode: status ?? !this.state.dualOutputMode,
    };
  }

  @mutation()
  private SET_DISPLAY_ACTIVE(status: boolean, display: TDisplayType) {
    this.state.videoSettings.activeDisplays = {
      ...this.state.videoSettings.activeDisplays,
      [display]: status,
    };
  }

  @mutation()
  private SET_VIDEO_SETTING(setting: Partial<IVideoInfo>, display: TDisplayType = 'vertical') {
    this.state.videoSettings[display] = {
      ...this.state.videoSettings[display],
      ...setting,
    };
  }

  @mutation()
  private UPDATE_VIDEO_SETTING(setting: IVideoInfo, display: TDisplayType = 'vertical') {
    this.state.videoSettings[display] = { ...setting };
  }

  @mutation()
  private SET_IS_LOADING(status: boolean) {
    this.state = { ...this.state, isLoading: status };
  }
}
