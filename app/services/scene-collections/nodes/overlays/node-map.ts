import { Node } from '../node';
import { Inject } from 'services/core';
import { ScenesService } from 'services/scenes';

interface ISceneNodeMapSchema {
  sceneNodeMaps: { [sceneId: string]: Dictionary<string> };
}

/** The node map node exists to persist the scene node maps for dual output scene collections.
 *  The scene node maps are the foundation of dual output; they enable the
 *  horizontal and vertical nodes to reference each other.
 *
 *  Only dual output scene collections will have a scene node map.
 *
 *  When dual output was first released, the node map was loaded into scene collections state
 *  and also into the scene collection manifest entry.
 *
 *  It is now loaded into the scenes service state when a scene collection is made active.
 */
export class NodeMapNode extends Node<ISceneNodeMapSchema, {}> {
  schemaVersion = 1;

  @Inject() scenesService: ScenesService;

  async save() {
    if (this.scenesService.views?.sceneNodeMaps) {
      this.data = {
        sceneNodeMaps: this.scenesService.views?.sceneNodeMaps,
      };
    }
  }

  async load() {
    if (this.data?.sceneNodeMaps) {
      this.scenesService.initNodeMaps(this.data.sceneNodeMaps);
    }
  }
}
