import { test, expect } from './support/regression';
import { TEXT } from './support/duelMocks';

test('blocking errors and Backspace preserve progress; reset clears the counters', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('#nav-to-simulator').click();
  await page.keyboard.type('t');
  await expect(page.locator('#typed-part')).toHaveText('t');
  await page.keyboard.type('x');
  await expect(page.locator('#error-indicator')).toContainText("Blocked: Press 'h'");
  await expect(page.locator('#stat-position')).toHaveText('1 / 43');
  await expect(page.locator('#stat-keypresses')).toHaveText('2');
  await expect(page.locator('#stat-first-attempt')).toHaveText('1');
  await page.keyboard.press('Backspace');
  await expect(page.locator('#typed-part')).toHaveText('t');
  await expect(page.locator('#stat-keypresses')).toHaveText('2');
  await expect(page.locator('#error-indicator')).toBeVisible();
  await page.keyboard.type('he');
  await expect(page.locator('#stat-position')).toHaveText('3 / 43');
  await expect(page.locator('#stat-keypresses')).toHaveText('4');
  await expect(page.locator('#stat-first-attempt')).toHaveText('2');
  await expect(page.locator('#error-indicator')).toHaveCount(0);
  await page.locator('#btn-reset-text').click();
  await expect(page.locator('#stat-position')).toHaveText('0 / 43');
  await expect(page.locator('#stat-keypresses')).toHaveText('0');
  await expect(page.locator('#stat-first-attempt')).toHaveText('0');
  await expect(page.getByRole('textbox')).toBeFocused();
});

test('completed practice restarts and manual results allow a fresh run or return to menu', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('#nav-to-simulator').click();
  await page.keyboard.type(TEXT);
  await expect(page.locator('#complete-banner')).toBeVisible();
  await expect(page.locator('#stat-position')).toHaveText('43 / 43');
  await page.locator('#btn-restart-practice').click();
  await expect(page.locator('#complete-banner')).toHaveCount(0);
  await expect(page.locator('#stat-position')).toHaveText('0 / 43');
  await page.keyboard.type('the');
  await expect(page.locator('#typed-part')).toHaveText('the');
  await page.locator('#nav-sim-to-results').click();
  await expect(page.locator('#screen-results')).toBeVisible();
  await expect(page.locator('#main-content')).toBeFocused();
  await page.locator('#nav-results-to-sim').click();
  await expect(page.locator('#stat-position')).toHaveText('0 / 43');
  await expect(page.getByRole('textbox')).toBeFocused();
  await page.locator('#nav-sim-to-results').click();
  await page.locator('#nav-results-to-menu').click();
  await expect(page.locator('#screen-menu')).toBeVisible();
  await expect(page.locator('#main-content')).toBeFocused();
});

test('Esc restarts the practice', async ({ page }) => {
  await page.goto('/');
  await page.locator('#nav-to-simulator').click();
  await page.keyboard.type('the');
  await expect(page.locator('#stat-position')).toHaveText('3 / 43');
  await page.keyboard.press('Escape');
  await expect(page.locator('#stat-position')).toHaveText('0 / 43');
  await expect(page.locator('#stat-keypresses')).toHaveText('0');
  await expect(page.getByRole('textbox')).toBeFocused();
});
