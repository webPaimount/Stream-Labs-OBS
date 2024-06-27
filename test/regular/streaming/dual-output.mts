import {
  clickGoLive,
  prepareToGoLive,
  submit,
  waitForSettingsWindowLoaded,
} from '../../helpers/modules/streaming.mjs';
import {
  clickIfDisplayed,
  focusChild,
  focusMain,
  isDisplayed,
  waitForDisplayed,
} from '../../helpers/modules/core.mjs';
import { logIn } from '../../helpers/modules/user.mjs';
import { toggleDisplay, toggleDualOutputMode } from '../../helpers/modules/dual-output.mjs';
import { test, TExecutionContext, useWebdriver } from '../../helpers/webdriver/index.mjs';
import { releaseUserInPool, withPoolUser, withUser } from '../../helpers/webdriver/user.mjs';

useWebdriver();

/**
 * Toggle Dual Output Video Settings
 */
test('User must be logged in to use Dual Output', async (t: TExecutionContext) => {
  await toggleDualOutputMode(false);
  await focusChild();
  t.true(await isDisplayed('form#login-modal', { timeout: 1000 }));
});

test('Dual output checkbox toggles Dual Output mode', withUser(), async (t: TExecutionContext) => {
  await toggleDualOutputMode();
  await focusMain();
  t.true(await isDisplayed('div#vertical-display'));

  await toggleDualOutputMode();
  await focusMain();
  t.false(await isDisplayed('div#vertical-display'));
});

test('Cannot toggle Dual Output in Studio Mode', withUser(), async (t: TExecutionContext) => {
  const { app } = t.context;

  await toggleDualOutputMode();

  // attempt toggle studio mode from side nav
  await focusMain();
  await (await app.client.$('.side-nav .icon-studio-mode-3')).click();
  t.true(await isDisplayed('div=Cannot toggle Studio Mode in Dual Output Mode.'));
});

test(
  'Dual Output Selective Recording is Horizontal Only',
  withUser(),
  async (t: TExecutionContext) => {
    const { app } = t.context;

    await toggleDualOutputMode();
    await focusMain();
    await (await app.client.$('[data-name=sourcesControls] .icon-smart-record')).click();

    // Check that selective recording icon is active
    await (await app.client.$('.icon-smart-record.active')).waitForExist();

    t.false(await isDisplayed('div#vertical-display'));
  },
);

/**
 * Dual Output Go Live
 */

test(
  'Dual Output Go Live Non-Ultra',
  // non-ultra user
  withUser('twitch', { prime: false }),
  async t => {
    await toggleDualOutputMode();
    await prepareToGoLive();
    await clickGoLive();
    await waitForSettingsWindowLoaded();

    await waitForDisplayed('[data-test=non-ultra-switcher]');

    // cannot use dual output mode with only one platform linked
    await submit();
    await waitForDisplayed(
      'div=To use Dual Output you must stream to at least one horizontal and one vertical platform.',
    );

    t.pass();
  },
);

test(
  'Dual Output Go Live Ultra',
  withUser('twitch', { multistream: true }),
  async (t: TExecutionContext) => {
    // test going live with ultra
    await toggleDualOutputMode();
    await prepareToGoLive();
    await clickGoLive();
    await waitForSettingsWindowLoaded();

    await waitForDisplayed('[data-test=ultra-switcher]');

    // cannot use dual output mode with all platforms assigned to one display
    await submit();
    await waitForDisplayed(
      'div=To use Dual Output you must stream to at least one horizontal and one vertical platform.',
    );

    t.pass();
  },
);

/**
 * Dual Output Sources
 */

test('Dual output display toggles', withUser(), async (t: TExecutionContext) => {
  await toggleDualOutputMode();
  await focusMain();

  t.true(await isDisplayed('div#dual-output-header'));

  // check permutations of toggling on and off the displays
  await clickIfDisplayed('i#horizontal-display-toggle');
  t.false(await isDisplayed('div#horizontal-display'));
  t.true(await isDisplayed('div#vertical-display'));

  await toggleDisplay('vertical', true);
  t.false(await isDisplayed('div#horizontal-display'));
  t.false(await isDisplayed('div#vertical-display'));

  await toggleDisplay('horizontal');
  t.true(await isDisplayed('div#horizontal-display'));
  t.false(await isDisplayed('div#vertical-display'));

  await toggleDisplay('vertical');
  t.true(await isDisplayed('div#horizontal-display'));
  t.true(await isDisplayed('div#vertical-display'));

  await toggleDisplay('vertical');
  t.true(await isDisplayed('div#horizontal-display'));
  t.false(await isDisplayed('div#vertical-display'));

  await toggleDisplay('horizontal');
  t.false(await isDisplayed('div#horizontal-display'));
  t.false(await isDisplayed('div#vertical-display'));

  await toggleDisplay('vertical');
  t.false(await isDisplayed('div#horizontal-display'));
  t.true(await isDisplayed('div#vertical-display'));

  await toggleDisplay('horizontal');
  t.true(await isDisplayed('div#horizontal-display'));
  t.true(await isDisplayed('div#vertical-display'));
});
