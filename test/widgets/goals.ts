import test, { GenericTestContext } from 'ava';
import { useSpectron } from '../helpers/spectron/index';
import { addSource } from '../helpers/spectron/sources';
import { logIn } from '../helpers/spectron/user';
import { FormMonkey } from '../helpers/form-monkey';
import { waitForWidgetSettingsSync } from '../helpers/widget-helpers';

useSpectron({ appArgs: '--nosync' });


async function testGoal(t: GenericTestContext<any>, goalType: string) {

  const client = t.context.app.client;
  await logIn(t);
  await addSource(t, goalType, goalType, false);

  await client.click('li=Visual Settings');
  const formName = 'visual-properties-form';

  const formMonkey = new FormMonkey(t);

  const testSet1 = {
    layout: 'standard',
    background_color: '#FF0000',
    bar_color: '#FF0000',
    bar_bg_color: '#FF0000',
    text_color: '#FF0000',
    bar_text_color: '#FF0000',
    font: 'Roboto'
  };

  await formMonkey.fill(formName, testSet1);
  await waitForWidgetSettingsSync(t);
  t.true(await formMonkey.includes(formName, testSet1));

  const testSet2 = {
    layout: 'condensed',
    background_color: '#7ED321',
    bar_color: '#AB14CE',
    bar_bg_color: '#DDDDDD',
    text_color: '#FFFFFF',
    bar_text_color: '#F8E71C',
    font: 'Open Sans'
  };


  await formMonkey.fill(formName, testSet2);
  await waitForWidgetSettingsSync(t);
  t.true(await formMonkey.includes(formName, testSet2));
}


test('Donation Goal', async t => {
  await testGoal(t, 'Donation Goal');
});

test('Follower Goal', async t => {
  await testGoal(t, 'Follower Goal');
});

test('Bit Goal', async t => {
  await testGoal(t, 'Bit Goal');
});

