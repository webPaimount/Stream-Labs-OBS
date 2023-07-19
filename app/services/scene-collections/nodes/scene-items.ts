import { Node } from './node';
import { EBlendingMethod, EBlendingMode, EScaleType, Scene, ScenesService } from '../../scenes';
import { HotkeysNode } from './hotkeys';
import { SourcesService } from '../../sources';
import { Inject } from '../../core/injector';
import { TDisplayType, VideoSettingsService } from 'services/settings-v2';
import { DualOutputService } from 'services/dual-output';
import { IVideo } from 'obs-studio-node';

interface ISchema {
  items: TSceneNodeInfo[];
}

export interface ISceneItemInfo extends ISceneNodeInfo {
  sourceId: string;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  visible: boolean;
  crop: ICrop;
  hotkeys?: HotkeysNode;
  locked?: boolean;
  rotation?: number;
  streamVisible?: boolean;
  recordingVisible?: boolean;
  scaleFilter?: EScaleType;
  blendingMode?: EBlendingMode;
  blendingMethod?: EBlendingMethod;
  sceneNodeType: 'item';
}

interface ISceneItemFolderInfo extends ISceneNodeInfo {
  name: string;
  sceneNodeType: 'folder';
  childrenIds: string[];
}

interface ISceneNodeInfo {
  id: string;
  sceneNodeType: 'item' | 'folder';
  display?: TDisplayType;
  output?: IVideo;
}

export type TSceneNodeInfo = ISceneItemInfo | ISceneItemFolderInfo;

interface IContext {
  scene: Scene;
}

export class SceneItemsNode extends Node<ISchema, {}> {
  schemaVersion = 1;

  @Inject('SourcesService')
  sourcesService: SourcesService;

  @Inject('ScenesService')
  scenesService: ScenesService;

  @Inject('DualOutputService')
  dualOutputService: DualOutputService;

  @Inject('VideoSettingsService')
  videoSettingsService: VideoSettingsService;

  getItems(context: IContext) {
    return context.scene.getNodes().slice().reverse();
  }

  save(context: IContext): Promise<void> {
    const promises: Promise<TSceneNodeInfo>[] = this.getItems(context).map(sceneItem => {
      return new Promise(resolve => {
        const hotkeys = new HotkeysNode();

        if (sceneItem.isItem()) {
          const display =
            sceneItem?.display ??
            this.dualOutputService.views.getNodeDisplay(sceneItem.sceneItemId, sceneItem.sceneId);
          const context = this.videoSettingsService.contexts[display];

          hotkeys.save({ sceneItemId: sceneItem.sceneItemId }).then(() => {
            const transform = sceneItem.transform;
            resolve({
              hotkeys,
              id: sceneItem.sceneItemId,
              sourceId: sceneItem.sourceId,
              x: transform.position.x,
              y: transform.position.y,
              scaleX: transform.scale.x,
              scaleY: transform.scale.y,
              visible: sceneItem.visible,
              crop: transform.crop,
              locked: sceneItem.locked,
              rotation: transform.rotation,
              streamVisible: sceneItem.streamVisible,
              recordingVisible: sceneItem.recordingVisible,
              scaleFilter: sceneItem.scaleFilter,
              blendingMode: sceneItem.blendingMode,
              blendingMethod: sceneItem.blendingMethod,
              sceneNodeType: 'item',
              display,
              output: context,
            });
          });
        } else {
          resolve({
            ...sceneItem.getModel(),
            childrenIds: sceneItem.childrenIds,
          });
        }
      });
    });

    return new Promise(resolve => {
      Promise.all(promises).then(items => {
        this.data = { items };
        resolve();
      });
    });
  }

  /**
   * Do some data sanitizing
   */
  sanitizeIds() {
    // Look for duplicate ids
    const ids: Dictionary<boolean> = {};

    this.data.items = this.data.items.filter(item => {
      if (ids[item.id]) return false;

      ids[item.id] = true;
      return true;
    });
  }

  load(context: IContext): Promise<void> {
    this.sanitizeIds();

    this.data.items.forEach(item => {
      if (item.sceneNodeType === 'item') {
        if (item.streamVisible == null) item.streamVisible = true;
        if (item.recordingVisible == null) item.recordingVisible = true;
      }
    });

    if (
      this.dualOutputService.views.hasNodeMap(context.scene.id) &&
      !this.videoSettingsService.contexts.vertical
    ) {
      this.videoSettingsService.establishVideoContext('vertical');
    }

    context.scene.addSources(this.data.items);

    const promises: Promise<void>[] = [];

    this.data.items.forEach(item => {
      if (item.sceneNodeType === 'folder') return;
      const hotkeys = item.hotkeys;
      if (hotkeys) promises.push(hotkeys.load({ sceneItemId: item.id }));
    });

    return new Promise(resolve => {
      Promise.all(promises).then(() => resolve());
    });
  }
}
