import type { Page } from '@playwright/test';

export const TEXT = 'the quick brown fox jumps over the lazy dog';

export const ghostRecord = (msPerChar: number) => {
  const events = [...TEXT].map((key, index) => ({ t: 400 + (index + 1) * msPerChar, key }));
  return {
    version: 1,
    targetText: TEXT,
    locale: 'en',
    events,
    durationMs: (events[events.length - 1]?.t ?? 0) + 50,
  };
};

export const startBody = (isBot: boolean) => ({
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

export const mockPlayer = async (page: Page) => {
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
};

export const press = async (page: Page, keys: string[]) => {
  for (const key of keys) {
    await page.locator('[role=textbox]').evaluate((element, value) => {
      element.dispatchEvent(
        new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }),
      );
    }, key);
    await page.waitForTimeout(25);
  }
};
