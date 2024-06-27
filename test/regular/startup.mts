import { useWebdriver, test } from '../helpers/webdriver/index.mjs';
import { logIn } from '../helpers/webdriver/user.mjs';
import { sleep } from '../helpers/sleep.js';
import {
  focusChild,
  focusMain,
  getClient,
  waitForDisplayed,
  waitForLoader,
} from '../helpers/modules/core.mjs';

useWebdriver();

// TODO: Enable this test
test.skip('Twitch 2FA is disabled', async t => {
  await logIn(t, 'twitch', { '2FADisabled': true, notStreamable: true }, false);
  await sleep(5000); // TODO wait for MsgBox instead sleep;

  // Login did not work, we should still be logged out
  t.true(await (await t.context.app.client.$('h1=Connect')).isDisplayed());
});

// TODO: window refreshing is broken on Electron 14
test.skip('Window refresh should work', async t => {
  await getClient().keys('F5');
  await sleep(5000, true);
  await waitForDisplayed('.main-loading');
  await waitForLoader();
  t.pass();
});
