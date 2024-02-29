import {
  TExecutionContext,
  startApp,
  stopApp,
  test,
  useWebdriver,
} from '../../../helpers/webdriver';
import { logIn } from '../../../helpers/webdriver/user';
import { toggleDualOutputMode } from '../../../helpers/modules/dual-output';

const fs = require('fs');
const path = require('path');

function copyFile(src: string, dest: string) {
  return new Promise<void>((resolve, reject) => {
    const read = fs.createReadStream(src);
    const write = fs.createWriteStream(dest);

    read.on('error', (e: any) => reject(e));
    write.on('error', (e: any) => reject(e));
    write.on('finish', () => resolve());

    read.pipe(write);
  });
}

/**
 * Confirm if the scene collection is a vanilla or dual output collection
 * @remark - The identifiers of a dual output scene collection is the existence of
 * the sceneNodeMaps property in the scene collections manifest, and the nodeMaps
 * property in the scene collection json.
 * @param t - execution context
 * @param fileName - name of the json file to read
 * @param propName - property name to confirm
 * @param dualOutput - true if confirming that the collection is a dual output collection, false if confirming it's a vanilla collection
 */
function confirmIsCollectionType(
  t: TExecutionContext,
  fileName: string,
  propName: string,
  dualOutput?: boolean,
) {
  const filePath = path.join(t.context.cacheDir, 'slobs-client', 'SceneCollections', fileName);

  try {
    const data = JSON.parse(fs.readFileSync(filePath).toString());

    // confirm existence of identifying property
    if (dualOutput) {
      // dual output scene collections will have the sceneNodeMaps property in the manifest
      // and the nodeMap property in the nodes system
      const root =
        fileName === 'manifest.json' && data?.collections ? data?.collections[0] : data?.nodeMap;
      const isDualOutputCollection = root.hasOwnProperty(propName);
      t.true(isDualOutputCollection);
    } else {
      // vanilla scene collections will not have the sceneNodeMaps property in the manifest
      // and will not have the nodeMap property in the nodes system
      const root = fileName === 'manifest.json' && data?.collections ? data?.collections[0] : data;
      t.true(!root.hasOwnProperty(propName));
    }
  } catch (e: unknown) {
    console.log('Error ', e);
  }
}

useWebdriver({
  skipOnboarding: true,
  clearCollectionAfterEachTest: false,
  beforeAppStartCb: async t => {
    const dataDir = path.resolve(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      '..',
      'test',
      'data',
      'scene-collections',
      'dual-output-collection',
    );

    fs.mkdirSync(path.join(t.context.cacheDir, 'slobs-client'));
    const sceneCollectionsPath = path.join(t.context.cacheDir, 'slobs-client', 'SceneCollections');
    fs.mkdirSync(sceneCollectionsPath);

    // console.log('path join ', path.join(dataDir, 'dual-output-collection.json'));

    await copyFile(
      path.join(dataDir, 'dual-output-collection.json'),
      path.join(sceneCollectionsPath, 'c95e73a9-1082-4b08-8c2a-d96021892d5f.json'),
    );

    await copyFile(
      path.join(dataDir, 'dual-output-collection-manifest.json'),
      path.join(sceneCollectionsPath, 'manifest.json'),
    );
  },
});

test('Loads a dual-output scene collection', async (t: TExecutionContext) => {
  // confirm vanilla scene collections manifest does not have a sceneNodeMap
  confirmIsCollectionType(t, 'manifest.json', 'sceneNodeMaps', true);

  // confirm vanilla scene collection does not have a node map node
  confirmIsCollectionType(t, 'c95e73a9-1082-4b08-8c2a-d96021892d5f.json', 'nodeMap', true);

  // confirm vanilla scene collections manifest and scene collection after app restart
  await stopApp(t, false);
  await startApp(t);
  confirmIsCollectionType(t, 'manifest.json', 'sceneNodeMaps', true);
  confirmIsCollectionType(t, 'c95e73a9-1082-4b08-8c2a-d96021892d5f.json', 'nodeMap', true);
});
