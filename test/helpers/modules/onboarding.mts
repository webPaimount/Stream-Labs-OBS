import { click, clickButton, clickIfDisplayed, isDisplayed, useMainWindow } from './core.mjs';

export async function skipOnboarding() {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  await useMainWindow(async () => {
    if (!(await isDisplayed('h2=Live Streaming'))) return;
    // Uses advanced onboarding
    await click('h2=Live Streaming');
    await click('h2=Advanced');
    await click('button=Continue');
    // Auth
    await click('button=Skip');
    // OBS import
    await clickIfDisplayed('div=Start Fresh');
    // Hardware setup
    await click('button=Skip');
    // Ultra
    await click('button=Skip');
  });
}
