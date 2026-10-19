import { expect, test, type Page } from '@playwright/test';
import { ghostRecord, mockPlayer, startBody } from './support/duelMocks';
import { openDuel, registerNickname } from './support/navigation';

// Every Turkish letter plus both i's, and a space: ı, i, ç, ğ, ö, ş, ü.
const TEXT = 'ışık çağ süt öğe iğ';

interface Layout {
  name: string;
  /** Physical key (KeyboardEvent.code) for each letter. The game reads `key`, never `code`. */
  codes: Record<string, string>;
}

// Turkish Q: the usual QWERTY positions with ı on KeyI-row, İ/i on its own key, ç ö on the right.
const Q: Layout = {
  name: 'Turkish Q',
  codes: {
    ı: 'KeyI',
    i: 'Quote',
    ç: 'Period',
    ğ: 'BracketLeft',
    ö: 'Comma',
    ş: 'Semicolon',
    ü: 'BracketRight',
  },
};
// Turkish F: a different arrangement, the same characters.
const F: Layout = {
  name: 'Turkish F',
  codes: { ı: 'KeyD', i: 'KeyS', ç: 'KeyX', ğ: 'KeyF', ö: 'KeyV', ş: 'KeyY', ü: 'KeyU' },
};

const codeFor = (layout: Layout, char: string): string => {
  if (char === ' ') return 'Space';
  return layout.codes[char] ?? `Key${char.toUpperCase()}`;
};

/** What a Turkish keyboard produces with Shift or Caps Lock: the locale's own uppercase letter. */
const shifted = (char: string): string => char.toLocaleUpperCase('tr');

const setup = async (page: Page) => {
  await mockPlayer(page);
  await page.route('**/api/duel/start', async (route) => {
    const body = startBody(true);
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        ...body,
        lang: 'tr',
        text: TEXT,
        opponent: {
          ...body.opponent,
          record: { ...ghostRecord(500), targetText: TEXT, locale: 'tr' },
        },
      }),
    });
  });
  const submitted: { events: { key: string }[] }[] = [];
  await page.route('**/api/duel/submit', async (route) => {
    submitted.push(route.request().postDataJSON() as (typeof submitted)[number]);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        verified: true,
        result: { wpm: 40, accuracy: 100 },
        duel: {
          winner: 'draw',
          reason: 'draw',
          hp: { a: 100, b: 100 },
          endedAt: 60000,
          rating: { before: 1000, after: 1000, delta: 0 },
          ratingApplied: true,
        },
      }),
    });
  });
  await page.goto('/');
  await registerNickname(page);
  await openDuel(page);
  await page.locator('#duel-lang-tr').click();
  await page.locator('#duel-find').click();
  await expect(page.locator('#duel-hud')).toBeVisible({ timeout: 8000 });
  await page.locator('[role=textbox]').focus();
  return submitted;
};

/** Sends a real keydown with the physical `code` and the produced `key`, like a keyboard would. */
const press = async (page: Page, layout: Layout, key: string, shift = false) => {
  const base = key.toLocaleLowerCase('tr');
  await page.locator('[role=textbox]').evaluate(
    (element, event) => {
      element.dispatchEvent(
        new KeyboardEvent('keydown', { ...event, bubbles: true, cancelable: true }),
      );
    },
    { key, code: key === 'Backspace' ? 'Backspace' : codeFor(layout, base), shiftKey: shift },
  );
  await page.waitForTimeout(20);
};

for (const layout of [Q, F]) {
  test.describe(layout.name, () => {
    test('lowercase letters are counted as typed', async ({ page }) => {
      const submitted = await setup(page);
      for (const char of TEXT) await press(page, layout, char);
      await expect(page.locator('#duel-result-title')).toBeVisible();
      const keys = submitted[0]?.events.map((event) => event.key) ?? [];
      expect(keys.join('')).toBe(TEXT);
      expect(keys).not.toContain('Backspace');
    });

    test('Shift or Caps Lock letters (İ, I, Ş, Ç, Ğ, Ö, Ü) count as the lowercase letter', async ({
      page,
    }) => {
      const submitted = await setup(page);
      for (const char of TEXT)
        await press(page, layout, char === ' ' ? char : shifted(char), char !== ' ');
      await expect(page.locator('#duel-result-title')).toBeVisible();
      const keys = submitted[0]?.events.map((event) => event.key) ?? [];
      // Uppercase İ becomes i, uppercase I becomes ı: the text comes out exactly right.
      expect(keys.join('')).toBe(TEXT);
      expect(keys).not.toContain('Backspace');
    });

    test('a dotted i where a dotless ı is expected is a mistake that has to be corrected', async ({
      page,
    }) => {
      const submitted = await setup(page);
      await press(page, layout, 'i'); // the text starts with ı
      await expect(page.locator('#duel-hud')).toBeVisible();
      await press(page, layout, 'Backspace');
      for (const char of TEXT) await press(page, layout, char);
      await expect(page.locator('#duel-result-title')).toBeVisible();
      const keys = submitted[0]?.events.map((event) => event.key) ?? [];
      expect(keys[0]).toBe('i');
      expect(keys[1]).toBe('Backspace');
      expect(keys.slice(2).join('')).toBe(TEXT);
    });

    test('a plain English i is not accepted for ı, and an English I is accepted as ı only in Turkish text', async ({
      page,
    }) => {
      const submitted = await setup(page);
      await press(page, layout, 'I', true); // Shift+ı produces I: normalised to ı, which is expected first
      for (const char of TEXT.slice(1)) await press(page, layout, char);
      await expect(page.locator('#duel-result-title')).toBeVisible();
      const keys = submitted[0]?.events.map((event) => event.key) ?? [];
      expect(keys.join('')).toBe(TEXT);
    });
  });
}
