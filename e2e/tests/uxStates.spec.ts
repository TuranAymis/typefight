import { expect, test, type Page } from '@playwright/test';
import { TEXT, mockPlayer, startBody } from './support/duelMocks';
import { openDuel, registerNickname } from './support/navigation';

const profileBody = {
  playerId: 'p1',
  nickname: 'Ada',
  rating: 1016,
  sessions: 5,
  bestWpm: 88,
  averageAccuracy: 96.5,
  duels: { played: 4, won: 3, lost: 1, drawn: 0 },
  badges: [],
};

const activeId = (page: Page) => page.evaluate(() => document.activeElement?.id ?? '');

test('profile shows a loading state, then an error with retry, then the stats', async ({
  page,
}) => {
  await mockPlayer(page);
  // The dev server runs effects twice, so the number of requests is not reliable: use a flag.
  let failing = true;
  await page.route('**/api/profile/p1', async (route) => {
    if (failing) {
      await new Promise((resolve) => setTimeout(resolve, 600));
      await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(profileBody),
    });
  });

  await page.goto('/');
  await registerNickname(page);
  await page.locator('#nav-to-profile').click();
  await expect(page.locator('#profile-loading')).toBeVisible();
  await expect(page.locator('#profile-error')).toBeVisible();
  await expect(page.locator('#profile-error')).toContainText('Could not load the profile');
  failing = false;
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.locator('#stat-rating')).toHaveText('1016');
  await expect(page.locator('#profile-error')).toHaveCount(0);
  await expect(page.locator('#profile-loading')).toHaveCount(0);
});

test('a failed duel result upload shows an error and retry delivers the result', async ({
  page,
}) => {
  await mockPlayer(page);
  await page.route('**/api/duel/start', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify(startBody(true)),
    });
  });
  let submits = 0;
  await page.route('**/api/duel/submit', async (route) => {
    submits += 1;
    if (submits === 1) {
      await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        sessionId: 's1',
        verified: true,
        newBadges: [],
        result: { wpm: 80, accuracy: 100 },
        duel: {
          winner: 'player',
          reason: 'hp',
          hp: { a: 100, b: 40 },
          endedAt: 60000,
          rating: { before: 1000, after: 1016, delta: 16 },
          ratingApplied: true,
        },
      }),
    });
  });

  await page.goto('/');
  await registerNickname(page);
  await openDuel(page);
  await page.locator('#duel-find').click();
  await expect(page.locator('#duel-hud')).toBeVisible({ timeout: 8000 });
  await page.locator('[role=textbox]').focus();
  await page.keyboard.type(TEXT, { delay: 30 });

  await expect(page.locator('#duel-error')).toContainText('Something went wrong');
  await page.locator('#duel-retry').click();
  await expect(page.locator('#duel-result-title')).toHaveText('Victory');
  expect(submits).toBe(2);
});

test('keyboard only: skip link, focus after navigation and a visible focus ring', async ({
  page,
}) => {
  await page.route('**/api/leaderboard**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ entries: [], me: undefined }),
    });
  });
  await page.goto('/');
  await expect(page.locator('#screen-menu')).toBeVisible();

  // The first Tab stop is the skip link; it jumps to the main content.
  await page.keyboard.press('Tab');
  expect(await activeId(page)).toBe('skip-to-content');
  const ring = await page.evaluate(() => {
    const style = getComputedStyle(document.activeElement as Element);
    return { style: style.outlineStyle, width: style.outlineWidth };
  });
  expect(ring.style).not.toBe('none');
  expect(ring.width).not.toBe('0px');
  await page.keyboard.press('Enter');
  expect(await activeId(page)).toBe('main-content');

  // Tab to the leaderboard button and open it with Enter.
  for (let i = 0; i < 20 && (await activeId(page)) !== 'nav-to-leaderboard'; i++) {
    await page.keyboard.press('Tab');
  }
  expect(await activeId(page)).toBe('nav-to-leaderboard');
  await page.keyboard.press('Enter');
  await expect(page.locator('#board-empty')).toBeVisible();

  // The button that had focus is gone; focus must not be stranded on the page body.
  expect(await activeId(page)).toBe('main-content');

  // Tab reaches the back button, Enter returns to the menu, focus stays inside the app.
  for (let i = 0; i < 20 && (await activeId(page)) !== 'board-back'; i++) {
    await page.keyboard.press('Tab');
  }
  expect(await activeId(page)).toBe('board-back');
  await page.keyboard.press('Enter');
  await expect(page.locator('#screen-menu')).toBeVisible();
  expect(await activeId(page)).toBe('main-content');
});
