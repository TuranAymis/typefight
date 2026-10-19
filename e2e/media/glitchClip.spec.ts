import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import type { SessionRecord } from '@typefight/engine';
import { mockPlayer, startBody } from '../tests/support/duelMocks';
import { openDuel } from '../tests/support/navigation';

// Records the gameplay clip used on the release page. Not part of the test suite:
//   npx playwright test -c playwright.media.config.ts              (frames for the GIF)
//   CLIP_VIDEO=1 npx playwright test -c playwright.media.config.ts (slower, ~30 s, saved as a video)
// It saves numbered PNG frames (with their timestamps) to media/frames/; scripts/make-gif.py turns them
// into the GIF.
const TEXT = 'noise alpha beta gamma delta epsilon zeta eta theta omega iota kappa lambda sigma';
const EFFECTS = ['scramble', 'blackout', 'static', 'overclock'] as const;

const FRAMES = 'media/frames';
const VIDEO = process.env['CLIP_VIDEO'] === '1';
// The video clip is slower, so a viewer can follow every glitch.
const GHOST_STEP_MS = VIDEO ? 380 : 130;
const KEY_PACE_MS = VIDEO ? 290 : 95;

test('a duel in which the ghost hits the player with every glitch', async ({ page }) => {
  await mockPlayer(page);
  const words = TEXT.split(' ');
  const glitch = {
    version: 1,
    markers: EFFECTS.map((effect, id) => ({
      id,
      wordIndex: id * 2,
      charIndex: 0,
      effect,
      string: words[id * 2]!,
    })),
  };
  // The ghost types a word every ~700 ms, so a glitch lands about every 1.4 s.
  const keys = [...words.slice(0, 9).join(' ')].concat(' ');
  const ghost: SessionRecord = {
    version: 1,
    locale: 'en',
    targetText: TEXT,
    glitch,
    events: keys.map((key, index) => ({ key, t: (index + 1) * GHOST_STEP_MS })),
    durationMs: 60000,
  };
  await page.route('**/api/duel/start', (route) =>
    route.fulfill({
      status: 201,
      json: {
        ...startBody(false),
        text: TEXT,
        glitch,
        opponent: { ...startBody(false).opponent, record: ghost },
      },
    }),
  );
  await page.goto('/');
  await page.locator('#nav-to-nickname').click();
  await page.locator('#nickname-input').fill('Ada');
  await page.locator('#nickname-save').click();
  await page.waitForTimeout(800);
  await openDuel(page);
  await page.locator('#duel-find').click();
  await expect(page.locator('#duel-hud')).toBeVisible({ timeout: 15000 });
  rmSync(FRAMES, { recursive: true, force: true });
  mkdirSync(FRAMES, { recursive: true });
  const stamps: number[] = [];
  let recording = !VIDEO;
  const started = Date.now();
  const capture = (async () => {
    while (recording) {
      const png = await page.screenshot({ type: 'png' });
      writeFileSync(`${FRAMES}/f${String(stamps.length).padStart(4, '0')}.png`, png);
      stamps.push(Date.now() - started);
    }
  })();
  const surface = page.locator('[role=textbox]');
  await surface.focus();
  // A person types at a steady pace; the ghost's glitches interrupt it.
  for (const key of TEXT.slice(0, 70)) {
    await page.keyboard.press(key === ' ' ? 'Space' : key);
    await page.waitForTimeout(KEY_PACE_MS);
  }
  await page.waitForTimeout(1200);
  recording = false;
  await capture;
  writeFileSync(`${FRAMES}/stamps.json`, JSON.stringify(stamps));
});
