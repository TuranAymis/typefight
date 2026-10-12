import { expect, test } from '@playwright/test';

const TEXT = 'the quick brown fox jumps over the lazy dog';

const ghostRecord = (msPerChar: number) => {
  const events = [...TEXT].map((key, index) => ({ t: 400 + (index + 1) * msPerChar, key }));
  return {
    version: 1,
    targetText: TEXT,
    locale: 'en',
    events,
    durationMs: (events[events.length - 1]?.t ?? 0) + 50,
  };
};

const startBody = (isBot: boolean) => ({
  sessionId: 's1',
  sessionToken: 't'.repeat(64),
  mode: 'duel',
  lang: 'en',
  textId: 'en-001',
  text: TEXT,
  seed: 1,
  opponent: {
    sessionId: 'ghost-1',
    nickname: isBot ? '[BOT] 30 WPM' : 'Rival',
    rating: 850,
    isBot,
    wpm: 30,
    record: ghostRecord(400),
  },
});

test('duel flow: find opponent, countdown, fight with live HP, result, rematch and new opponent', async ({
  page,
}) => {
  await page.route('**/api/player', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        created: true,
        playerId: 'p1',
        nickname: 'Ada',
        deviceToken: 'a'.repeat(64),
      }),
    });
  });
  const startBodies: Record<string, unknown>[] = [];
  const submissions: { events: { t: number; key: string }[]; durationMs: number }[] = [];
  await page.route('**/api/duel/start', async (route) => {
    startBodies.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify(startBody(startBodies.length === 1)),
    });
  });
  await page.route('**/api/duel/submit', async (route) => {
    submissions.push(route.request().postDataJSON() as (typeof submissions)[number]);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        sessionId: 's1',
        verified: true,
        result: { wpm: 80, accuracy: 100 },
        duel: {
          winner: 'player',
          reason: 'hp',
          hp: { a: 100, b: 71 },
          endedAt: 60000,
          rating: { before: 1000, after: 1016, delta: 16 },
          ratingApplied: true,
        },
      }),
    });
  });

  await page.goto('/');
  await page.locator('#nav-to-nickname').click();
  await page.locator('#nickname-input').fill('Ada');
  await page.locator('#nickname-save').click();
  await page.locator('#nav-to-duel').click();
  await page.locator('#duel-find').click();

  // Match found shows the bot label, then 3-2-1.
  await expect(page.locator('#duel-opponent-name')).toHaveText('[BOT] 30 WPM');
  await expect(page.locator('#duel-opponent-info')).toContainText('Training bot');
  await expect(page.locator('#duel-countdown')).toBeVisible();
  await expect(page.locator('#duel-hud')).toBeVisible({ timeout: 8000 });
  await expect(page.locator('#hp-player')).toHaveAttribute('aria-valuenow', '100');
  await expect(page.locator('#hp-opponent')).toHaveAttribute('aria-valuenow', '100');

  await page.locator('[role=textbox]').focus();
  await page.keyboard.type('the quick ', { delay: 40 });
  await expect(page.locator('#hp-opponent')).not.toHaveAttribute('aria-valuenow', '100');
  await expect(page.locator('#duel-combo')).toContainText('x2');
  await page.keyboard.type('brown fox jumps over the lazy dog', { delay: 40 });

  await expect(page.locator('#duel-result-title')).toHaveText('Victory');
  await expect(page.locator('#duel-result-rating')).toContainText('1000 → 1016 (+16)');
  expect(submissions).toHaveLength(1);
  expect(submissions[0]?.events.map((event) => event.key).join('')).toBe(TEXT);
  expect(submissions[0]?.durationMs).toBeGreaterThan(
    submissions[0]?.events.at(-1)?.t ?? Infinity - 1,
  );

  await page.locator('#duel-rematch').click();
  await expect(page.locator('#duel-opponent-name')).toHaveText('Rival');
  expect(startBodies[1]).toEqual({ lang: 'en', rematchSessionId: 'ghost-1' });
});

test('duel shows an error with retry when the server is down', async ({ page }) => {
  await page.route('**/api/player', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        created: true,
        playerId: 'p1',
        nickname: 'Ada',
        deviceToken: 'a'.repeat(64),
      }),
    });
  });
  let down = true;
  await page.route('**/api/duel/start', async (route) => {
    if (down) await route.abort();
    else {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(startBody(false)),
      });
    }
  });
  await page.goto('/');
  await page.locator('#nav-to-nickname').click();
  await page.locator('#nickname-input').fill('Ada');
  await page.locator('#nickname-save').click();
  await page.locator('#nav-to-duel').click();
  await page.locator('#duel-find').click();
  await expect(page.locator('#duel-error')).toContainText('Could not reach');
  down = false;
  await page.locator('#duel-retry').click();
  await expect(page.locator('#duel-opponent-name')).toHaveText('Rival');
});
