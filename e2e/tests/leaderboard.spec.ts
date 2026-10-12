import { expect, test } from '@playwright/test';

const row = (rank: number, nickname: string, wpm: number) => ({
  rank,
  playerId: `p${rank}`,
  nickname,
  wpm,
  accuracy: 97,
});

test('leaderboard shows API order, switches filters and handles errors', async ({ page }) => {
  const requests: string[] = [];
  let fail = true;
  await page.route('**/api/leaderboard**', async (route) => {
    const url = new URL(route.request().url());
    requests.push(`${url.searchParams.get('lang')}/${url.searchParams.get('period')}`);
    if (fail) {
      await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
      return;
    }
    const empty = url.searchParams.get('lang') === 'tr';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        entries: empty ? [] : [row(1, 'Ada', 120), row(2, 'Bo', 100), row(3, 'Cy', 90)],
        me: empty ? undefined : row(57, 'Me', 40),
      }),
    });
  });

  await page.goto('/');
  await page.locator('#nav-to-leaderboard').click();
  await expect(page.locator('#board-error')).toBeVisible();

  fail = false;
  await page.getByRole('button', { name: 'Retry' }).click();
  const names = page.locator('#board-table tbody tr td:nth-child(2)');
  await expect(names).toHaveText(['Ada', 'Bo', 'Cy']);
  await expect(page.locator('#board-my-rank')).toContainText('#57');

  await page.locator('#board-period-all').click();
  await page.locator('#board-lang-tr').click();
  await expect(page.locator('#board-empty')).toBeVisible();
  expect(requests).toContain('en/daily');
  expect(requests).toContain('tr/all');

  await page.locator('#board-back').click();
  await expect(page.locator('#screen-menu')).toBeVisible();
});
