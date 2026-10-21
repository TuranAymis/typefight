import { test, expect, EMPTY_PROFILE } from './support/regression';
import { mockPlayer, startBody, TEXT } from './support/duelMocks';
import { openDuel, registerNickname } from './support/navigation';

for (const failure of ['http', 'network'] as const) {
  test(`player creation ${failure} failure is readable and can be retried`, async ({ page }) => {
    await page.route('**/api/player', (route) =>
      failure === 'network' ? route.abort('failed') : route.fulfill({ status: 500, json: {} }),
    );
    await page.goto('/');
    await registerNickname(page);
    await expect(page.locator('#nickname-error')).toHaveText(
      failure === 'network'
        ? 'Cannot reach the server. Check your connection and try again.'
        : 'Something went wrong on our side. Please try again.',
    );
    await expect(page.locator('#nickname-save')).toBeEnabled();
    await expect(page.locator('#nickname-input')).toHaveValue('Ada');
    await mockPlayer(page);
    await page.locator('#nickname-save').click();
    await expect(page.locator('#player-line')).toContainText('Playing as Ada');
  });
}

for (const screen of ['leaderboard', 'profile'] as const) {
  test(`${screen} network failure exits loading and retry recovers`, async ({ page }) => {
    await page.goto('/');
    if (screen === 'profile') await registerNickname(page);
    const endpoint = screen === 'profile' ? '**/api/profile/p1' : '**/api/leaderboard**';
    await page.route(endpoint, (route) => route.abort('failed'));
    await page.locator(`#nav-to-${screen}`).click();
    const prefix = screen === 'profile' ? 'profile' : 'board';
    await expect(page.locator(`#${prefix}-error`)).toContainText('Could not load');
    await expect(page.locator(`#${prefix}-loading`)).toHaveCount(0);
    await expect(page.locator(`#${prefix}-back`)).toBeEnabled();
    await page.route(endpoint, (route) =>
      route.fulfill({ json: screen === 'profile' ? EMPTY_PROFILE : { entries: [] } }),
    );
    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(
      page.locator(screen === 'profile' ? '#profile-stats' : '#board-empty'),
    ).toBeVisible();
    await expect(page.locator(`#${prefix}-error`)).toHaveCount(0);
    await expect(page.locator(`#${prefix}-loading`)).toHaveCount(0);
  });
}

test('an unused profile displays zero statistics and no earned badges', async ({ page }) => {
  await page.goto('/');
  await registerNickname(page);
  await page.locator('#nav-to-profile').click();
  await expect(page.locator('#stat-rating')).toHaveText('1000');
  await expect(page.locator('#stat-best-wpm')).toHaveText('0');
  await expect(page.locator('#stat-accuracy')).toHaveText('0%');
  await expect(page.locator('#stat-win-rate')).toHaveText('0%');
  await expect(page.locator('#stat-duels')).toHaveText('0');
  await expect(page.locator('#badges-title')).toHaveText('Badges (0/10)');
  await expect(page.locator('[data-earned="true"]')).toHaveCount(0);
  await expect(page.locator('#profile-loading')).toHaveCount(0);
});

test('recovery-code generation failure can be retried without losing the profile', async ({
  page,
}) => {
  await page.route('**/api/player/recovery-code', (route) =>
    route.fulfill({ status: 500, json: {} }),
  );
  await page.goto('/');
  await registerNickname(page);
  await page.locator('#nav-to-profile').click();
  await page.locator('#recovery-generate').click();
  await expect(page.locator('#recovery-error')).toHaveText('Could not create a code. Try again.');
  await expect(page.locator('#profile-stats')).toBeVisible();
  await page.route('**/api/player/recovery-code', (route) =>
    route.fulfill({ json: { recoveryCode: 'ABCDE-FGHJK-MNPQR-STUVW' } }),
  );
  await page.locator('#recovery-generate').click();
  await expect(page.locator('#recovery-code')).toHaveText('ABCDE-FGHJK-MNPQR-STUVW');
  await expect(page.locator('#recovery-error')).toHaveCount(0);
});

for (const timing of ['paced', 'same timestamp'] as const) {
  test(`duel session submission network failure retries the same recorded run (${timing})`, async ({
    page,
  }) => {
    await page.route('**/api/duel/start', (route) =>
      route.fulfill({ status: 201, json: startBody(true) }),
    );
    const submissions: unknown[] = [];
    await page.route('**/api/duel/submit', async (route) => {
      submissions.push(route.request().postDataJSON());
      if (submissions.length === 1) await route.abort('failed');
      else
        await route.fulfill({
          json: {
            verified: true,
            newBadges: [],
            result: { wpm: 80, accuracy: 100 },
            duel: {
              winner: 'player',
              reason: 'wpm',
              hp: { a: 100, b: 40 },
              endedAt: 60000,
              rating: { before: 1000, after: 1016, delta: 16 },
              ratingApplied: true,
            },
          },
        });
    });
    await page.goto('/');
    await registerNickname(page);
    await openDuel(page);
    await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
    await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
    await page.locator('#duel-find').click();
    await expect(page.locator('#duel-opponent-name')).toBeVisible();
    await page.clock.runFor(1500);
    for (let second = 0; second < 3; second++) await page.clock.runFor(1000);
    await expect(page.locator('#duel-hud')).toBeVisible();
    await page.getByRole('textbox').focus();
    for (const key of TEXT) {
      await page.keyboard.type(key);
      if (timing === 'paced') await page.clock.runFor(40);
    }
    await page.clock.runFor(32);
    await expect(page.locator('#duel-error')).toHaveText(
      'Could not reach the server. Check your connection.',
    );
    await page.locator('#duel-retry').click();
    await expect(page.locator('#duel-result-title')).toHaveText('Victory');
    expect(submissions).toHaveLength(2);
    expect(submissions[1]).toEqual(submissions[0]);
  });
}
