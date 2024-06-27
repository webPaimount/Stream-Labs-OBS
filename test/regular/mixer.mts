import { useWebdriver, test } from '../helpers/webdriver/index.mjs';
import {
  addSource,
  selectSource,
  clickRemoveSource,
  addExistingSource,
} from '../helpers/modules/sources.mjs';
import { addScene } from '../helpers/modules/scenes.mjs';
import { click, focusChild, focusMain, waitForDisplayed } from '../helpers/modules/core.mjs';
useWebdriver();

test('Adding and removing a AudioSource', async t => {
  const app = t.context.app;

  await addSource('Media File', 'Source With Audio');
  await addSource('Color Block', 'Source Without Audio');
  await focusMain();

  t.true(
    await (await (await app.client.$('.mixer-panel')).$('div=Source With Audio')).isExisting(),
  );
  t.false(
    await (await (await app.client.$('.mixer-panel')).$('div=Source Without Audio')).isExisting(),
  );

  await selectSource('Source With Audio');
  await clickRemoveSource('Source With Audio');

  await (await (await app.client.$('.mixer-panel')).$('div=Source With Audio')).waitForExist({
    timeout: 5000,
    reverse: true,
  });
});

test('Nested scenes should provide audio sources to mixer', async t => {
  const app = t.context.app;

  await addSource('Media File', 'Nested Media Source');
  await focusMain();

  await addScene('New Scene');
  await addSource('Media File', 'Simple Media Source');
  await addExistingSource('Scene', 'Scene');

  await focusMain();
  t.true(
    await (await (await app.client.$('.mixer-panel')).$('div=Simple Media Source')).isExisting(),
  );
  t.true(
    await (await (await app.client.$('.mixer-panel')).$('div=Nested Media Source')).isExisting(),
  );
});

test('Advanced audio', async t => {
  await click('[role="show-advanced-audio"]');
  await focusChild();
  await click('span=Global Settings');
  await waitForDisplayed('label=Audio Monitoring Device');
  t.pass();
});
