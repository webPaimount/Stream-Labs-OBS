import { MetricsService } from '../../../app/services/metrics';
import {
  test,
  stopApp,
  startApp,
  TExecutionContext,
  getCacheDir,
} from '../../helpers/spectron';
import { ApiClient, getClient } from '../../helpers/api-client';
import { TSourceType } from '../../../app/services/sources/sources-api';
import { ScenesService } from '../../../app/services/api/external-api/scenes';
import { getMeter } from '../meter';
import { spawnSync } from 'child_process';
import { sleep } from '../../helpers/sleep';
import { setOutputResolution, setTemporaryRecordingPath } from '../../helpers/spectron/output';
import { startRecording, stopRecording } from '../../helpers/spectron/streaming';
import { getCPUUsage, getMemoryUsage, logTiming, usePerformanceTest } from '../tools';
import { logIn } from '../../helpers/spectron/user';
import { ExecutionContext } from 'ava';
const fs = require('fs-extra');
const _7z = require('7zip')['7z'];
const path = require('path');

usePerformanceTest();

const RELOAD_ATTEMPTS = 15;
const CPU_ATTEMPTS = 100;
const ADD_SOURCES_ATTEMPTS = 5;

/**
 * unzip a sample of a large scene collection to the SceneCollection folder
 */
function unzipLargeSceneCollection(t: TExecutionContext) {
  const cacheDir = path.resolve(getCacheDir(), 'slobs-client');
  const sceneCollectionPath = path.resolve(cacheDir, 'SceneCollections');
  fs.removeSync(sceneCollectionPath);

  const dataDir = path.resolve(__dirname, '..', '..', '..', '..', 'test', 'data');
  const sceneCollectionZip = path.resolve(
    dataDir,
    'scene-collections',
    'huge-scene-collection.zip',
  );
  spawnSync(_7z, ['x', sceneCollectionZip, `-o${cacheDir}`]);
}

function measureStartupTime(api: ApiClient) {
  const meter = getMeter();
  const metricsService = api.getResource<MetricsService>('MetricsService');
  const appMetrics = metricsService.getMetrics();
  meter.addMeasurement('mainWindowShow', appMetrics.mainWindowShowTime - appMetrics.appStartTime);
  meter.addMeasurement(
    'sceneCollectionLoad',
    appMetrics.sceneCollectionLoadingTime - appMetrics.mainWindowShowTime,
  );
}

async function measureMemoryAndCPU(t: ExecutionContext, attempts = CPU_ATTEMPTS) {
  logTiming(t, 'Start recodring CPU and Memory');
  const meter = getMeter();
  while (attempts--) {
    meter.addMeasurement('CPU', await getCPUUsage());
    meter.addMeasurement('memory', await getMemoryUsage());
    await sleep(2000);
  }
  logTiming(t, 'Stop recodring CPU and Memory');
}

test('Bundle size', async t => {
  const meter = getMeter();
  const bundlePath = path.resolve(__dirname, '..', '..', '..', '..', 'bundles');
  const rendererPath = path.resolve(bundlePath, 'renderer.js');
  const updaterPath = path.resolve(bundlePath, 'updater.js');
  const rendererSize = fs.statSync(rendererPath).size;
  const updaterSize = fs.statSync(updaterPath).size;
  meter.addMeasurement('renderer-js', rendererSize);
  meter.addMeasurement('updater-js', updaterSize);
  t.pass();
});

test('Empty collection', async t => {
  await stopApp(t, false);

  // measure startup time
  let attempts = RELOAD_ATTEMPTS;
  while (attempts--) {
    await startApp(t);
    const api = await getClient();
    measureStartupTime(api);
    await stopApp(t, false);
  }

  // measure memory and CPU
  await startApp(t);
  await measureMemoryAndCPU(t);

  t.pass();
});

test('Large collection', async t => {
  await sleep(2000);
  await stopApp(t, false);
  await unzipLargeSceneCollection(t);

  // measure startup time
  let i = RELOAD_ATTEMPTS;
  while (i--) {
    await startApp(t);
    const api = await getClient();
    measureStartupTime(api);
    await stopApp(t, false);
  }

  // measure memory and CPU
  await startApp(t);
  await measureMemoryAndCPU(t);
  t.pass();
});

test('Empty collection (logged-in twitch)', async t => {
  const meter = getMeter();
  await logIn(t, 'twitch');
  await sleep(2000);
  await stopApp(t, false);

  // measure startup time
  let attempts = RELOAD_ATTEMPTS;
  while (attempts--) {
    await startApp(t);
    const api = await getClient();
    measureStartupTime(api);
    await stopApp(t, false);
  }
  t.pass();
});

test('Recording', async t => {
  await setTemporaryRecordingPath(t);
  await setOutputResolution(t, '100x100');
  const api = await getClient();
  const scenesService = api.getResource<ScenesService>('ScenesService');
  scenesService.activeScene.createAndAddSource('Color', 'color_source');

  await startRecording(t);
  await measureMemoryAndCPU(t);
  await stopRecording(t);

  t.pass();
});

test('Add and remove sources', async t => {
  const api = await getClient();
  const scenesService = api.getResource<ScenesService>('ScenesService');
  const meter = getMeter();
  scenesService.activeScene.createAndAddSource('Color', 'color_source');

  const sourceTypes = [
    'Video Capture Device',
    'Audio Output Capture',
    'Audio Input Capture',
    'Game Capture',
    'Window Capture',
    'Display Capture',
    'Image',
    'Image Slide Show',
    'Media Source',
    'Text (GDI+)',
    'Color Source',
    'Browser Source',
  ];

  // create and delete 10 instances for each source type 3 times
  let attempts = ADD_SOURCES_ATTEMPTS;
  while (attempts--) {
    meter.startMeasure('addSources');
    let sourcesCount = 10;
    while (sourcesCount--) {
      const folder = scenesService.activeScene.createFolder(`folder ${sourcesCount}`);
      sourceTypes.forEach(type => {
        const item = scenesService.activeScene.createAndAddSource(type, type as TSourceType);
        folder.add(item.id);
      });
    }
    meter.stopMeasure('addSources');

    meter.startMeasure('removeSources');
    scenesService.activeScene.getNodes().forEach(node => {
      node.remove();
    });
    meter.stopMeasure('removeSources');

    // give some time to unfreeze UI
    await sleep(2000);
  }
  t.pass();
});
