import { Node } from '../node';
import { Inject } from 'services/core';
import { SceneCollectionsService } from 'services/scene-collections';

interface ISceneNodeMapSchema {
  sceneNodeMaps: { [sceneId: string]: Dictionary<string> };
}

export class NodeMapNode extends Node<ISceneNodeMapSchema, {}> {
  schemaVersion = 1;

  @Inject() sceneCollectionsService: SceneCollectionsService;

  async save() {
    if (this.sceneCollectionsService.activeCollection.hasOwnProperty('sceneNodeMaps')) {
      this.data.sceneNodeMaps = this.sceneCollectionsService.activeCollection.sceneNodeMaps;
      this.sceneCollectionsService.flushManifestFile();
    }
  }

  async load() {
    this.sceneCollectionsService.initNodeMaps(this.data.sceneNodeMaps);
  }

  // migrate(version: number) {
  //   if (version === 1) {
  //     // init the scene node maps property
  //     this.data.sceneNodeMaps = {};
  //   }
  // }
}
