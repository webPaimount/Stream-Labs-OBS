import { readdir } from 'fs-extra';
import { test, useWebdriver } from '../helpers/webdriver/index.mjs';
import { sleep } from '../helpers/sleep.js';
import {
  setOutputResolution,
  setTemporaryRecordingPath,
  showSettingsWindow,
} from '../helpers/modules/settings/settings.mjs';
import { click, isDisplayed } from '../helpers/modules/core.mjs';
import {
  saveReplayBuffer,
  startReplayBuffer,
  stopReplayBuffer,
} from '../helpers/modules/replay-buffer.mjs';

useWebdriver();

test('Replay Buffer', async t => {
  const tmpDir = await setTemporaryRecordingPath();
  await setOutputResolution('100x100');

  // record a fragment
  await startReplayBuffer();
  await saveReplayBuffer();
  await stopReplayBuffer();

  // Check that the replay-buffer file has been created
  await sleep(3000);
  const files = await readdir(tmpDir);
  t.is(files.length, 1);

  // disable replay buffer
  await showSettingsWindow('Output', async () => {
    await click('label=Enable Replay Buffer');
  });

  // check Start Replay Buffer is not visible
  t.false(await isDisplayed('button .icon-replay-buffer'));
});
