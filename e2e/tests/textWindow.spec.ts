import { expect, test } from '@playwright/test';
import { openDuel } from './support/navigation';

// One-letter words keep the damage low so the opponent is not knocked out while we scroll.
const LONG_TEXT = Array.from({ length: 100 }, (_, i) => 'abcdefghijklmnopqrstuvwxyz'[i % 26]).join(
  ' ',
);

test.use({ viewport: { width: 390, height: 844 } });

test('the text shows as a three-line window that follows the cursor on a phone', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
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
  await page.route('**/api/duel/start', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        sessionId: 's1',
        sessionToken: 't'.repeat(64),
        mode: 'duel',
        lang: 'en',
        textId: 'long',
        text: LONG_TEXT,
        seed: 1,
        opponent: {
          sessionId: 'g1',
          nickname: '[BOT] 30 WPM',
          rating: 700,
          isBot: true,
          wpm: 30,
          record: {
            version: 1,
            targetText: LONG_TEXT,
            locale: 'en',
            events: [{ t: 60000, key: 'w' }],
            durationMs: 60050,
          },
        },
      }),
    });
  });

  await page.goto('/');
  await page.locator('#nav-to-nickname').click();
  await page.locator('#nickname-input').fill('Ada');
  await page.locator('#nickname-save').click();
  await openDuel(page);
  await page.locator('#duel-find').click();
  await expect(page.locator('#duel-window')).toBeVisible({ timeout: 8000 });

  const window = page.locator('#duel-window');
  const box = await window.boundingBox();
  const lineHeight = await page.evaluate(() => {
    const el = document.querySelector('#duel-stream span');
    return el ? parseFloat(getComputedStyle(el).lineHeight) : 0;
  });
  // Exactly three lines tall.
  expect(Math.abs((box?.height ?? 0) - lineHeight * 3)).toBeLessThan(2);

  await page.locator('[role=textbox]').focus();
  await page.keyboard.type(LONG_TEXT.slice(0, 90), { delay: 8 });

  const scrollTop = await window.evaluate((element) => element.scrollTop);
  expect(scrollTop).toBeGreaterThan(0);
  // Measured after typing: the HUD above the window may have moved the page a little.
  const finalBox = await window.boundingBox();
  const cursor = await page.locator('[data-cursor]').boundingBox();
  expect(cursor?.y).toBeGreaterThanOrEqual((finalBox?.y ?? 0) - 1);
  expect((cursor?.y ?? 0) + (cursor?.height ?? 0)).toBeLessThanOrEqual(
    (finalBox?.y ?? 0) + (finalBox?.height ?? 0) + 1,
  );
  // The cursor sits on the middle line, not the first.
  expect(Math.abs((cursor?.y ?? 0) - ((finalBox?.y ?? 0) + lineHeight))).toBeLessThan(
    lineHeight / 2,
  );
});
