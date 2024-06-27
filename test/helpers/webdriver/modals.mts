import { TExecutionContext } from './index.mjs';
import { sleep } from '../sleep.js';

export async function dismissModal(t: TExecutionContext) {
  // For some reason, clicking to dismiss the modal isn't working on the latest
  // version of webdriverio, so we dismiss with the escape key instead
  await t.context.app.client.keys('Escape');

  // Wait for dismiss animation to play
  await sleep(500);
}
