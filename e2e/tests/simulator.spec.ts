import { expect, test } from '@playwright/test';

test('simulator mode, blocking input, timeout, results and restart', async ({ page }) => {
  await page.goto('/');
  await page.locator('#nav-to-simulator').click();
  await page.getByRole('button', { name: '15s' }).click();
  await page.getByRole('button', { name: 'TR' }).click();
  await expect(page.getByRole('button', { name: '15s' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'TR' })).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#start-simulator').click();
  const surface = page.getByRole('textbox', { name: 'Typing surface' });
  await expect(surface).toBeFocused();
  const target = await page.locator('#typing-stream').getAttribute('aria-label');
  expect(target).toBeTruthy();
  const first = target?.slice(0, 8) ?? '';
  const mistake = first[0] === 'x' ? 'z' : 'x';
  await page.keyboard.type(mistake);
  await expect(page.locator('#stat-position')).toContainText('0 /');
  await surface.dispatchEvent('paste', { bubbles: true, cancelable: true });
  await expect(page.locator('#stat-position')).toContainText('0 /');
  await page.keyboard.type(first);
  await expect(page.locator('#stat-position')).toContainText('8 /');
  await expect(page.locator('#screen-results')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('#result-mode')).toContainText('15s · TR');
  for (const id of ['result-wpm', 'result-raw-wpm', 'result-accuracy', 'result-consistency']) {
    await expect(page.locator(`#${id}`)).toHaveText(/^\d+(?:\.\d+)?%?$/);
  }
  await page.locator('#restart-simulator').click();
  await expect(page.getByRole('textbox', { name: 'Typing surface' })).toBeFocused();
  await expect(page.locator('#stat-position')).toContainText('0 /');
});
