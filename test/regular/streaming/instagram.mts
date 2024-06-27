import { test, useWebdriver } from '../../helpers/webdriver/index.mjs';
import {
  clickGoLive,
  prepareToGoLive,
  stopStream,
  submit,
  waitForSettingsWindowLoaded,
  waitForStreamStart,
} from '../../helpers/modules/streaming.mjs';
import { addDummyAccount, withUser } from '../../helpers/webdriver/user.mjs';
import { fillForm } from '../../helpers/modules/forms/index.mjs';
import { waitForDisplayed } from '../../helpers/modules/core.mjs';

useWebdriver();

test('Streaming to Instagram', withUser('twitch', { prime: true, multistream: false }), async t => {
  // test approved status
  const dummy = await addDummyAccount('instagram');

  await prepareToGoLive();
  await clickGoLive();
  await waitForSettingsWindowLoaded();
  await fillForm({
    instagram: true,
  });
  await waitForSettingsWindowLoaded();

  await fillForm({
    title: 'Test stream',
    twitchGame: 'Fortnite',
    streamUrl: dummy.streamUrl,
    streamKey: dummy.streamKey,
  });
  await submit();
  await waitForDisplayed('span=Update settings for Instagram');
  await waitForStreamStart();
  await stopStream();

  t.pass();
});
