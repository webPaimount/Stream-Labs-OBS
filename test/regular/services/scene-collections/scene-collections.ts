import {
  TExecutionContext,
  restartApp,
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
  dualOutput: boolean = false,
) {
  const filePath = path.join(t.context.cacheDir, 'slobs-client', 'SceneCollections', fileName);

  console.log('propName ', propName, 'fileName ', fileName);
  try {
    const data = JSON.parse(fs.readFileSync(filePath).toString());

    // confirm existence of identifying property
    if (dualOutput) {
      // dual output scene collections will have the sceneNodeMaps property in the manifest
      // and the nodeMap property in the nodes system
      const root = fileName === 'manifest.json' && data?.collections ? data?.collections[0] : data;
      t.true(root.hasOwnProperty(propName));
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

async function populateCollection(t: TExecutionContext) {
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
    'vanilla-collection',
  );

  console.log('contect ', t.context.cacheDir);

  if (!fs.existsSync(t.context.cacheDir)) {
    fs.mkdirSync(path.join(t.context.cacheDir, 'slobs-client'));
  }

  const sceneCollectionsPath = path.join(t.context.cacheDir, 'slobs-client', 'SceneCollections');
  if (!fs.existsSync(sceneCollectionsPath)) {
    fs.mkdirSync(sceneCollectionsPath);
  }

  await copyFile(
    path.join(dataDir, 'vanilla-collection.json'),
    path.join(sceneCollectionsPath, '3c6cf522-6b85-4d64-a152-236939c63686.json'),
  );

  await copyFile(
    path.join(dataDir, 'vanilla-collection-manifest.json'),
    path.join(sceneCollectionsPath, 'manifest.json'),
  );
}

useWebdriver({
  skipOnboarding: true,
  // clearCollectionAfterEachTest: true,
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
      'vanilla-collection',
    );

    console.log('contect ', t.context.cacheDir);

    if (!fs.existsSync(t.context.cacheDir)) {
      fs.mkdirSync(path.join(t.context.cacheDir, 'slobs-client'));
    }

    const sceneCollectionsPath = path.join(t.context.cacheDir, 'slobs-client', 'SceneCollections');
    if (!fs.existsSync(sceneCollectionsPath)) {
      fs.mkdirSync(sceneCollectionsPath);
    }

    await copyFile(
      path.join(dataDir, 'vanilla-collection.json'),
      path.join(sceneCollectionsPath, '3c6cf522-6b85-4d64-a152-236939c63686.json'),
    );

    await copyFile(
      path.join(dataDir, 'vanilla-collection-manifest.json'),
      path.join(sceneCollectionsPath, 'manifest.json'),
    );
    //   const dataDir = path.resolve(
    //     __dirname,
    //     '..',
    //     '..',
    //     '..',
    //     '..',
    //     '..',
    //     'test',
    //     'data',
    //     'scene-collections',
    //     'vanilla-collection',
    //   );

    //   fs.mkdirSync(path.join(t.context.cacheDir, 'slobs-client'));
    //   const sceneCollectionsPath = path.join(t.context.cacheDir, 'slobs-client', 'SceneCollections');
    //   fs.mkdirSync(sceneCollectionsPath);

    //   await copyFile(
    //     path.join(dataDir, 'vanilla-collection.json'),
    //     path.join(sceneCollectionsPath, '3c6cf522-6b85-4d64-a152-236939c63686.json'),
    //   );

    //   await copyFile(
    //     path.join(dataDir, 'vanilla-collection-manifest.json'),
    //     path.join(sceneCollectionsPath, 'manifest.json'),
    //   );
  },
});

test('Loads a vanilla scene collection', async (t: TExecutionContext) => {
  // confirm dual output scene collections manifest after conversion
  // await logIn(t);

  await populateCollection(t);

  // confirm vanilla scene collections manifest does not have a sceneNodeMap
  confirmIsCollectionType(t, 'manifest.json', 'sceneNodeMaps');

  // confirm vanilla scene collection does not have a node map node
  confirmIsCollectionType(t, '3c6cf522-6b85-4d64-a152-236939c63686.json', 'nodeMap');

  // restart app
  await restartApp(t);
  // confirm vanilla scene collections manifest and scene collection after app reload
  // confirmIsCollectionType(t, 'manifest.json', 'sceneNodeMaps');
  // confirmIsCollectionType(t, '3c6cf522-6b85-4d64-a152-236939c63686.json', 'nodeMap', true);
});

test('Loads a vanilla scene collection and saves a dual output collection', async t => {
  // confirm dual output scene collections manifest after conversion
  await logIn(t);
  await toggleDualOutputMode();

  // confirm dual output scene collections manifest after app restart
  await stopApp(t, false);
  await startApp(t, true);
  confirmIsCollectionType(t, 'manifest.json', 'sceneNodeMaps', true);
  confirmIsCollectionType(t, '3c6cf522-6b85-4d64-a152-236939c63686.json', 'nodeMap', true);
});
