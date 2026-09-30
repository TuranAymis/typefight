import { expect, test } from '@playwright/test';

test('home screen renders the TypeFight brand and menu', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/TypeFight/);
  await expect(page.getByText('CURRENT SCREEN: MENU')).toBeVisible();
});
