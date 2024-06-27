let lastEventTime = 0;
import {
  afterAppStart,
  afterAppStop,
  TExecutionContext,
  useWebdriver,
} from '../helpers/webdriver/index.mjs';
import test, { ExecutionContext } from 'ava';
import { getApiClient } from '../helpers/api-client.js';
import { PerformanceService } from '../../app/services/performance.js';
import { getMeter } from './meter.js';
import tasklist, { ITask } from 'tasklist';
import path from 'path';
import fs from 'fs-extra';

const CONFIG = fs.readJsonSync('test/performance/config.json');

useWebdriver({});

export function usePerformanceTest() {
  let testName = '';

  afterAppStart(t => {
    logTiming(t, 'App started');
  });

  afterAppStop(t => {
    logTiming(t, 'App stopped');
  });

  test.beforeEach(async t => {
    testName = t.title.replace('beforeEach hook for ', '');
    logTiming(t, `Test "${testName}" started`);
    getMeter().reset();
    if (!fs.pathExistsSync(CONFIG.dist)) fs.mkdirpSync(CONFIG.dist);
  });

  test.afterEach(async (t: TExecutionContext) => {
    // save events to file
    const meter = getMeter();
    const savedEventsFile = path.resolve(CONFIG.dist, 'performance-results.json');
    const savedEvents = fs.pathExistsSync(savedEventsFile) ? fs.readJsonSync(savedEventsFile) : {};
    savedEvents[testName] = meter.getRecordedEvents();
    fs.writeJsonSync(savedEventsFile, savedEvents);
    logTiming(t, `Test "${testName}" finished`);
  });
}

export async function getMemoryUsage(): Promise<number> {
  const tasks: ITask[] = await tasklist();
  const slobsTasks = tasks.filter(task => {
    return [
      'electron.exe',
      'obs64.exe',
      'obs-browser-page.exe',
      'crash-handler-process.exe',
      'obs-ffmpeg-mux.exe',
    ].includes(task.imageName);
  });

  let memUsage = 0;
  slobsTasks.forEach(tasks => (memUsage += tasks.memUsage));
  return memUsage;
}

export async function getCPUUsage(): Promise<number> {
  const api = await getApiClient();
  const performanceService = api.getResource<PerformanceService>('PerformanceService');
  const cpuUsage = performanceService.state.CPU;
  return cpuUsage;
}

/**
 * log time passed from the last logTiming call
 * @param msg
 */
export function logTiming(t: ExecutionContext, msg: string, time = Date.now()) {
  const delta = lastEventTime ? time - lastEventTime : 0;
  lastEventTime = time;
  t.log(msg, delta + 'ms');
}
