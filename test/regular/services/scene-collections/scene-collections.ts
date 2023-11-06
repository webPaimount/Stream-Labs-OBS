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
    const sceneCollectionsPath = path.join(t.context.cacheDir, 'slobs-client', 'SceneCollections');

    if (fs.existsSync(sceneCollectionsPath)) return;

    const dataDir = path.resolve(__dirname, '..', '..', '..', '..', '..', 'test', 'data');

    fs.mkdirSync(path.join(t.context.cacheDir, 'slobs-client'));
    fs.mkdirSync(sceneCollectionsPath);

    await copyFile(
      path.join(dataDir, 'scene-collection.json'),
      path.join(sceneCollectionsPath, '4e467470-923c-43a3-90d2-2be39c8c34ee.json'),
    );

    await copyFile(
      path.join(dataDir, 'manifest.json'),
      path.join(sceneCollectionsPath, 'manifest.json'),
    );
  },
});

test('Loads a vanilla scene collection', async (t: TExecutionContext) => {
  // confirm vanilla scene collections manifest does not have a sceneNodeMap
  confirmIsCollectionType(t, 'manifest.json', 'sceneNodeMaps');

  // confirm vanilla scene collection does not have a node map node
  confirmIsCollectionType(t, '4e467470-923c-43a3-90d2-2be39c8c34ee.json', 'nodeMap');

  // confirm vanilla scene collections manifest and scene collection after app reload
  await stopApp(t, false);
  await startApp(t);
  confirmIsCollectionType(t, 'manifest.json', 'sceneNodeMaps');
  confirmIsCollectionType(t, '4e467470-923c-43a3-90d2-2be39c8c34ee.json', 'nodeMap');
});

test('Loads a vanilla scene collection and saves a dual output collection', async t => {
  // confirm dual output scene collections manifest after conversion
  await logIn(t);
  await toggleDualOutputMode();

  // confirm dual output scene collections manifest after app restart
  await stopApp(t, false);
  await startApp(t, true);
  confirmIsCollectionType(t, 'manifest.json', 'sceneNodeMaps', true);
  confirmIsCollectionType(t, '4e467470-923c-43a3-90d2-2be39c8c34ee.json', 'sceneNodeMaps', true);
});
