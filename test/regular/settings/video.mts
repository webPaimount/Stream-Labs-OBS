import { test, useWebdriver } from '../../helpers/webdriver/index.mjs';
import { useForm } from '../../helpers/modules/forms/form.mjs';
import { showSettingsWindow } from '../../helpers/modules/settings/settings.mjs';
import { sleep } from '../../helpers/sleep.js';

useWebdriver();

test('Populates video settings', async t => {
  await showSettingsWindow('Video');
  const { assertInputOptions } = useForm();

  await t.notThrowsAsync(async () => {
    await assertInputOptions('scaleType', 'Bilinear (Fastest, but blurry if scaling)', [
      'Bilinear (Fastest, but blurry if scaling)',
      'Bicubic (Sharpened scaling, 16 samples)',
      'Lanczos (Sharpened scaling, 32 samples)',
    ]);

    await assertInputOptions('fpsType', 'Integer FPS Values', [
      'Common FPS Values',
      'Integer FPS Values',
      'Fractional FPS Values',
    ]);
  });
});

test('Populates common fps values', async t => {
  await showSettingsWindow('Video');
  const videoSettingsForm = useForm('video-settings');

  await videoSettingsForm.fillForm({
    fpsType: 'Common FPS Values',
  });

  // wait for fps settings to sync between horizontal and vertical contexts
  await sleep(500);

  await t.notThrowsAsync(async () => {
    await videoSettingsForm.assertInputOptions('fpsCom', '30', [
      '10',
      '20',
      '24 NTSC',
      '29.97',
      '30',
      '48',
      '59.94',
      '60',
    ]);
  });
});
