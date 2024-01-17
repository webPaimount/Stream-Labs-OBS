import { click, clickButton, clickIfDisplayed, isDisplayed, useMainWindow } from './core';

export async function skipOnboarding() {
  await useMainWindow(async () => {
    if (!(await isDisplayed('h2=Live Streaming'))) return;
    // Uses advanced onboarding
    await click('h2=Live Streaming');
    await click('h2=Advanced');
    await click('button=Continue');
    // OBS import
    await clickIfDisplayed('div=Start Fresh');
    // Hardware setup
    await click('button=Skip');
    // Ultra
    await click('button=Skip');
  });
}
