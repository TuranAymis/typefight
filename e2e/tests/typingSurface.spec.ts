import { expect, test } from '@playwright/test';

test('simulator types from the focused surface and rejects paste', async ({ page }) => {
  await page.goto('/');
  await page.locator('#nav-to-simulator').click();
  const surface = page.getByRole('textbox', { name: 'Yazma alanı' });
  await expect(surface).toBeFocused();
  await page.keyboard.type('the');
  await expect(page.locator('#stat-position')).toHaveText('3 / 43');
  await surface.dispatchEvent('paste', { bubbles: true, cancelable: true });
  await expect(page.getByRole('alert')).toHaveText('Yapıştırmaya izin verilmiyor.');
  await expect(page.locator('#stat-position')).toHaveText('3 / 43');
});
