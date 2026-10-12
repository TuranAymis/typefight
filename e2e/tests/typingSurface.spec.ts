import { expect, test } from '@playwright/test';

test('simulator input surface rejects paste', async ({ page }) => {
  await page.goto('/');
  await page.locator('#nav-to-simulator').click();
  await page.locator('#start-simulator').click();
  const surface = page.getByRole('textbox', { name: 'Typing surface' });
  await expect(surface).toBeFocused();
  await surface.dispatchEvent('paste', { bubbles: true, cancelable: true });
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.locator('#stat-position')).toContainText('0 /');
});
