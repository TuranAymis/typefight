import { expect, test, type Page } from '@playwright/test';
import { installFakeAudio, playedSounds } from './support/audio';
import { TEXT, mockPlayer, startBody } from './support/duelMocks';
import { openDuel, registerNickname } from './support/navigation';

const TUTORIAL_TEXT = 'find your rhythm each word lands a hit stay calm and keep typing';

const count = async (page: Page, name: string) =>
  (await playedSounds(page)).filter((sound) => sound === name).length;

const mockDuel = async (page: Page, winner: 'player' | 'opponent') => {
  await mockPlayer(page);
  await page.route('**/api/duel/start', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify(startBody(true)),
    });
  });
  await page.route('**/api/duel/submit', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        sessionId: 's1',
        verified: true,
        newBadges: [],
        result: { wpm: 60, accuracy: 100 },
        duel: {
          winner,
          reason: 'hp',
          hp: { a: winner === 'player' ? 100 : 20, b: winner === 'player' ? 20 : 100 },
          endedAt: 60000,
          rating: { before: 1000, after: 1010, delta: winner === 'player' ? 10 : -10 },
          ratingApplied: true,
        },
      }),
    });
  });
};

const fightAndFinish = async (page: Page) => {
  await page.goto('/');
  await registerNickname(page);
  await openDuel(page);
  await page.locator('#duel-find').click();
  await expect(page.locator('#duel-hud')).toBeVisible({ timeout: 8000 });
  await page.locator('[role=textbox]').focus();
  await page.keyboard.type(TEXT, { delay: 30 });
};

test('typing plays a key click for every keypress', async ({ page }) => {
  await installFakeAudio(page);
  await page.goto('/');
  await page.locator('#nav-to-simulator').click();
  await page.locator('[role=textbox]').focus();
  await page.keyboard.type('the quick', { delay: 40 });
  await expect.poll(() => count(page, 'key')).toBe(9);
});

test('the mute toggle silences everything and the choice survives a reload', async ({ page }) => {
  await installFakeAudio(page);
  await page.goto('/');
  const toggle = page.locator('#sound-toggle');
  await expect(toggle).toHaveText('Sound: on');
  await toggle.click();
  await expect(toggle).toHaveText('Sound: off');

  await page.locator('#nav-to-simulator').click();
  await page.locator('[role=textbox]').focus();
  await page.keyboard.type('the ', { delay: 40 });
  expect(await playedSounds(page)).toEqual([]);

  await page.reload();
  await expect(page.locator('#sound-toggle')).toHaveText('Sound: off');
  await page.locator('#nav-to-simulator').click();
  await page.locator('[role=textbox]').focus();
  await page.keyboard.type('the ', { delay: 40 });
  expect(await playedSounds(page)).toEqual([]);

  await page.locator('#sound-toggle').click();
  await expect(page.locator('#sound-toggle')).toHaveText('Sound: on');
  await page.locator('[role=textbox]').focus();
  await page.keyboard.type('qui', { delay: 40 });
  await expect.poll(() => count(page, 'key')).toBeGreaterThan(0);
});

test('a duel plays hit sounds while fighting and the victory jingle on a win', async ({ page }) => {
  await installFakeAudio(page);
  await mockDuel(page, 'player');
  await fightAndFinish(page);
  await expect(page.locator('#duel-result-title')).toHaveText('Victory');
  expect(await count(page, 'hit')).toBeGreaterThan(0);
  expect(await count(page, 'victory')).toBe(1);
  expect(await count(page, 'defeat')).toBe(0);
});

test('a lost duel plays the defeat sound once, not the victory jingle', async ({ page }) => {
  await installFakeAudio(page);
  await mockDuel(page, 'opponent');
  await fightAndFinish(page);
  await expect(page.locator('#duel-result-title')).toHaveText('Defeat');
  expect(await count(page, 'defeat')).toBe(1);
  expect(await count(page, 'victory')).toBe(0);
});

test('the tutorial glitch demo plays the glitch sound once', async ({ page }) => {
  await installFakeAudio(page);
  await page.goto('/');
  await page.locator('#nav-to-onboarding').click();
  await page.locator('[role=textbox]').focus();
  await page.keyboard.type(TUTORIAL_TEXT, { delay: 15 });
  await expect(page.locator('#onboarding-start-duel')).toBeVisible();
  expect(await count(page, 'glitch')).toBe(1);
});

test('the game still works when the browser has no Web Audio', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    (window as unknown as { AudioContext: unknown }).AudioContext = undefined;
  });
  await page.goto('/');
  await page.locator('#nav-to-simulator').click();
  await page.locator('[role=textbox]').focus();
  await page.keyboard.type('the quick', { delay: 20 });
  await expect(page.locator('#stat-position')).toContainText('9 /');
  expect(errors).toEqual([]);
});
