import { focusChild, click, clickCheckbox, clickButton, clickIfDisplayed } from './core.mjs';
import { showSettingsWindow } from './settings/settings.mjs';

/**
 * Toggle dual output mode
 */
export async function toggleDualOutputMode(closeChildWindow: boolean = true) {
  await showSettingsWindow('Video', async () => {
    await focusChild();
    await clickCheckbox('dual-output-checkbox');

    if (closeChildWindow) {
      await clickButton('Done');
    }
  });
}

/**
 * Toggle display
 */
export async function toggleDisplay(display: 'horizontal' | 'vertical', wait: boolean = false) {
  if (wait) {
    await clickIfDisplayed(`i#${display}-display-toggle`);
  } else {
    await click(`i#${display}-display-toggle`);
  }
}
