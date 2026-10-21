import { test, expect } from './support/regression';

test.use({ viewport: { width: 360, height: 740 } });

for (const screen of ['simulator', 'results', 'leaderboard'] as const) {
  test(`${screen} fits a 360 by 740 viewport without horizontal scroll`, async ({ page }) => {
    await page.route('**/api/leaderboard**', (route) =>
      route.fulfill({
        json: {
          entries: [{ rank: 1, playerId: 'p1', nickname: 'Ada', wpm: 120, accuracy: 97 }],
        },
      }),
    );
    await page.goto('/');
    await page.locator(`#nav-to-${screen}`).click();
    await expect(page.locator(`#screen-${screen}`)).toBeVisible();
    if (screen === 'leaderboard') await expect(page.locator('#board-table')).toBeVisible();
    if (screen === 'simulator') {
      await page.keyboard.type('the');
      await expect(page.locator('#typed-part')).toHaveText('the');
    }
    await expect
      .poll(() =>
        page.evaluate(() => ({
          document: document.documentElement.scrollWidth,
          body: document.body.scrollWidth,
          viewport: document.documentElement.clientWidth,
        })),
      )
      .toEqual({ document: 360, body: 360, viewport: 360 });
  });
}
