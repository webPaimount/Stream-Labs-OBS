import { Node } from './node';
import { SourcesNode } from './sources';
import { ScenesNode } from './scenes';
import { TransitionsNode } from './transitions';
import { HotkeysNode } from './hotkeys';
import { NodeMapNode } from './node-map';
import { Inject } from 'services/core';
import { VideoService } from 'services/video';
import { StreamingService } from 'services/streaming';
import { OS } from 'util/operating-systems';
import { GuestCamNode } from './guest-cam';
import { VideoSettingsService } from 'services/settings-v2/video';
import { DualOutputService } from 'services/dual-output';
import { SettingsService } from 'services/settings';
import { SceneCollectionsService } from '../scene-collections';

interface ISchema {
  /**
   * this is for backward compatibility with vanilla scene collections
   */
  baseResolution: {
    baseWidth: number;
    baseHeight: number;
  };
  /**
   * this is for scenes created with dual output
   */
  baseResolutions: {
    horizontal: {
      baseWidth: number;
      baseHeight: number;
    };
    vertical: {
      baseWidth: number;
      baseHeight: number;
    };
  };

  selectiveRecording?: boolean;
  dualOutputMode?: boolean;
  sources: SourcesNode;
  scenes: ScenesNode;
  hotkeys?: HotkeysNode;
  transitions?: TransitionsNode; // V2 Transitions
  nodeMap?: NodeMapNode;

  guestCam?: GuestCamNode;

  operatingSystem?: OS;
}

/**
 * This is the root node of the config file
 */
export class RootNode extends Node<ISchema, {}> {
  schemaVersion = 5;

  @Inject() videoService: VideoService;
  @Inject() streamingService: StreamingService;
  @Inject() videoSettingsService: VideoSettingsService;
  @Inject() dualOutputService: DualOutputService;
  @Inject() settingsService: SettingsService;
  @Inject() sceneCollectionsService: SceneCollectionsService;

  async save(): Promise<void> {
    const sources = new SourcesNode();
    const scenes = new ScenesNode();
    const transitions = new TransitionsNode();
    const hotkeys = new HotkeysNode();
    const guestCam = new GuestCamNode();
    const nodeMap = new NodeMapNode();

    await sources.save({});
    await scenes.save({});
    await transitions.save();
    await hotkeys.save({});
    await guestCam.save();
    await nodeMap.save();

    this.data = {
      sources,
      scenes,
      transitions,
      hotkeys,
      guestCam,
      nodeMap,
      baseResolution: this.videoService.baseResolution,
      baseResolutions: this.videoSettingsService.baseResolutions,
      selectiveRecording: this.streamingService.state.selectiveRecording,
      dualOutputMode: this.dualOutputService.views.dualOutputMode,
      operatingSystem: process.platform as OS,
    };
  }
  /**
   * In order to load the root node without errors on startup
   * there must be at least one video context established.
   * This if/else prevents an error by guaranteeing a video context exists.
   */
  async load(): Promise<void> {
    if (!this.videoSettingsService.contexts.horizontal) {
      const establishedContext = this.videoSettingsService.establishedContext.subscribe(
        async () => {
          this.videoService.setBaseResolutions(this.data.baseResolutions);
          this.streamingService.setSelectiveRecording(!!this.data.selectiveRecording);
          this.streamingService.setDualOutputMode(this.data.dualOutputMode);

          await this.data.transitions.load();
          await this.data.sources.load({});
          await this.data.scenes.load({});

          if (this.data.nodeMap) {
            console.log('loading node map init');
            await this.data.nodeMap.load();
          }

          if (this.data.hotkeys) {
            await this.data.hotkeys.load({});
          }

          if (this.data.guestCam) {
            await this.data.guestCam.load();
          }
          establishedContext.unsubscribe();
        },
      );
    } else {
      this.videoService.setBaseResolutions(this.data.baseResolutions);
      this.streamingService.setSelectiveRecording(!!this.data.selectiveRecording);
      this.streamingService.setDualOutputMode(this.data.dualOutputMode);

      if (this.data.nodeMap) {
        console.log('loading node map');
        await this.data.nodeMap.load();
      }

      await this.data.transitions.load();
      await this.data.sources.load({});
      await this.data.scenes.load({});

      if (this.data.hotkeys) {
        await this.data.hotkeys.load({});
      }

      if (this.data.guestCam) {
        await this.data.guestCam.load();
      }
    }
  }

  migrate(version: number) {
    // Changed name of transition node in version 2
    if (version < 2) {
      this.data.transitions = this.data['transition'];
    }

    // Added baseResolution in version 3
    if (version < 3) {
      this.data.baseResolution = this.videoService.baseResolution;
    }
    // Added multiple displays with individual base resolutions in version 4
    if (version < 4) {
      this.data.baseResolutions = this.videoService.baseResolutions;
    }

    // if (version < 5) {
    //   this.data.nodeMap = {} as NodeMapNode;
    // }
  }
}
