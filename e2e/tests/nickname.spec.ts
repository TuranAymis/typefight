import { expect, test } from '@playwright/test';

test('nickname screen rejects bad and filtered names and accepts a valid one', async ({ page }) => {
  await page.route('**/api/player', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        created: true,
        playerId: 'p1',
        nickname: 'Speedy_Fox',
        deviceToken: 'a'.repeat(64),
      }),
    });
  });
  await page.goto('/');
  await page.locator('#nav-to-nickname').click();

  await page.locator('#nickname-input').fill('ab');
  await page.locator('#nickname-save').click();
  await expect(page.getByRole('alert')).toContainText('at least');

  await page.locator('#nickname-input').fill('siktir');
  await page.locator('#nickname-save').click();
  await expect(page.getByRole('alert')).toContainText('not allowed');

  await page.locator('#nickname-input').fill('Speedy_Fox');
  await page.locator('#nickname-save').click();
  await expect(page.locator('#player-line')).toContainText('Playing as Speedy_Fox');

  // The identity survives a reload (IndexedDB), so the browser is recognised again.
  await page.reload();
  await expect(page.locator('#player-line')).toContainText('Playing as Speedy_Fox');
});
