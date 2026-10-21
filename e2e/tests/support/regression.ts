import { test as base, expect } from '@playwright/test';
import { mockPlayer } from './duelMocks';

export const EMPTY_PROFILE = {
  playerId: 'p1',
  nickname: 'Ada',
  rating: 1000,
  sessions: 0,
  bestWpm: 0,
  averageAccuracy: 0,
  duels: { played: 0, won: 0, lost: 0, drawn: 0 },
  badges: [],
  cursorEffect: 'default',
};

// Every new regression runs offline, and unexpected requests or application errors fail it.
export const test = base.extend<{ offlineGuard: void }>({
  offlineGuard: [
    async ({ page }, use) => {
      const errors: string[] = [];
      const unexpected: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() !== 'error') return;
        // Chromium reports intentional HTTP/network failures separately from application exceptions.
        if (
          message.location().url.includes('/api/') &&
          /^Failed to load resource:/.test(message.text())
        )
          return;
        errors.push(message.text());
      });
      await page.route('**/*', async (route) => {
        const url = new URL(route.request().url());
        if (url.pathname === '/api/events') {
          await route.fulfill({ status: 204 });
        } else if (url.pathname.startsWith('/api/')) {
          unexpected.push(url.pathname);
          await route.fulfill({ status: 404, json: {} });
        } else if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
          await route.continue();
        } else {
          await route.fulfill({ status: 200, body: '' });
        }
      });
      await mockPlayer(page);
      await page.route('**/api/profile/p1', (route) => route.fulfill({ json: EMPTY_PROFILE }));
      await page.route('**/api/leaderboard**', (route) => route.fulfill({ json: { entries: [] } }));
      await use();
      expect(unexpected, 'All API requests must have explicit mocks').toEqual([]);
      expect(errors, 'No application console errors or uncaught exceptions').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
