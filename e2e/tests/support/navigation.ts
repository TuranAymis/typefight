import type { Page } from '@playwright/test';

/**
 * Opens the duel screen from the menu. A fresh browser has not seen the tutorial yet, so the first
 * click lands on the onboarding screen; skip it (which also stores the "seen" flag) to reach the duel.
 */
export const openDuel = async (page: Page) => {
  await page.locator('#nav-to-duel').click();
  const onboarding = page.locator('#screen-onboarding');
  const duelReady = page.locator('#duel-find');
  await onboarding.or(duelReady).first().waitFor();
  if (await onboarding.isVisible()) {
    await page.locator('#onboarding-skip').click();
    await duelReady.waitFor();
  }
};

/** Registers the nickname "Ada" (the player API must already be mocked) so the duel entry shows. */
export const registerNickname = async (page: Page) => {
  await page.locator('#nav-to-nickname').click();
  await page.locator('#nickname-input').fill('Ada');
  await page.locator('#nickname-save').click();
};
