import { expect, test } from '@playwright/test';

const OLD_TOKEN = 'a'.repeat(64);
const NEW_TOKEN = 'b'.repeat(64);

test('profile shows stats, creates a recovery code and restores it on a fresh browser', async ({
  page,
  context,
}) => {
  await page.route('**/api/player', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        created: true,
        playerId: 'p1',
        nickname: 'Ada',
        deviceToken: OLD_TOKEN,
      }),
    });
  });
  await page.route('**/api/profile/p1', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        playerId: 'p1',
        nickname: 'Ada',
        rating: 1016,
        sessions: 5,
        bestWpm: 88,
        averageAccuracy: 96.5,
        duels: { played: 4, won: 3, lost: 1, drawn: 0 },
        badges: [{ id: 'first-duel', earnedAt: 1 }],
      }),
    });
  });
  let auth = '';
  await page.route('**/api/player/recovery-code', async (route) => {
    auth = route.request().headers()['authorization'] ?? '';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ recoveryCode: 'ABCDE-FGHJK-MNPQR-STUVW' }),
    });
  });

  await page.goto('/');
  await page.locator('#nav-to-nickname').click();
  await page.locator('#nickname-input').fill('Ada');
  await page.locator('#nickname-save').click();
  await page.locator('#nav-to-profile').click();

  await expect(page.locator('#stat-rating')).toHaveText('1016');
  await expect(page.locator('#stat-best-wpm')).toHaveText('88');
  await expect(page.locator('#stat-accuracy')).toHaveText('96.5%');
  await expect(page.locator('#stat-win-rate')).toHaveText('75%');
  await expect(page.locator('#stat-duels')).toHaveText('4');

  await expect(page.locator('#badge-list li')).toHaveCount(10);
  await expect(page.locator('[data-badge=first-duel]')).toHaveAttribute('data-earned', 'true');
  await expect(page.locator('[data-badge=wins-50]')).toHaveAttribute('data-earned', 'false');

  await page.locator('#recovery-generate').click();
  await expect(page.locator('#recovery-code')).toHaveText('ABCDE-FGHJK-MNPQR-STUVW');
  expect(auth).toBe(`Bearer ${OLD_TOKEN}`);

  // A fresh browser profile restores the account with the code.
  const fresh = await context.browser()!.newContext();
  const other = await fresh.newPage();
  await other.route('**/api/player/recover', async (route) => {
    const code = (route.request().postDataJSON() as { code: string }).code;
    if (code !== 'ABCDE-FGHJK-MNPQR-STUVW') {
      await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ playerId: 'p1', nickname: 'Ada', deviceToken: NEW_TOKEN }),
    });
  });
  await other.goto('/');
  await other.locator('#nav-to-nickname').click();
  await other.locator('#recovery-input').fill('WRONG-CODE');
  await other.locator('#recovery-restore').click();
  await expect(other.locator('#recovery-error')).toContainText('not valid');
  await other.locator('#recovery-input').fill('ABCDE-FGHJK-MNPQR-STUVW');
  await other.locator('#recovery-restore').click();
  await expect(other.locator('#player-line')).toContainText('Playing as Ada');
  await fresh.close();
});
