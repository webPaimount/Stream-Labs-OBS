import { afterAppStart, test, useWebdriver } from '../../../helpers/webdriver/index.mjs';
import { logIn } from '../../../helpers/webdriver/user.mjs';
import { fillForm } from '../../../helpers/form-monkey.mjs';
import {
  addWidget,
  EWidgetType,
  waitForWidgetSettingsSync,
} from '../../../helpers/widget-helpers.mjs';
import { useScreentest } from '../../screenshoter';

useWebdriver({ restartAppAfterEachTest: false });
useScreentest();
afterAppStart(async t => {
  await logIn(t);
  await addWidget(t, EWidgetType.ChatBox, 'chatbox');
});

test('Chatbox Visual Settings', async t => {
  await (await t.context.app.client.$('li=Visual Settings')).click();
  await fillForm(t, 'form[name=visual-properties-form]', {
    theme: 'twitch',
    show_moderator_icons: true,
    show_subscriber_icons: true,
    show_turbo_icons: true,
    show_premium_icons: true,
    show_bits_icons: true,
    show_coin_icons: true,
    show_bttv_emotes: true,
    show_franker_emotes: true,
    background_color: '#000000',
    message_hide_delay: 60,
  });
  await waitForWidgetSettingsSync(t);
  t.pass();
});

test('Chatbox Font Settings', async t => {
  await (await t.context.app.client.$('li=Font Settings')).click();
  await fillForm(t, 'form[name=font-properties-form]', {
    text_color: '#FF0000',
    text_size: 20,
  });
  await waitForWidgetSettingsSync(t);
  t.pass();
});

test('Chatbox Font Chatter', async t => {
  await (await t.context.app.client.$('li=Chatter')).click();
  await waitForWidgetSettingsSync(t);
  t.pass();
});
