import { defineConfig, devices } from '@playwright/test';

/** The API address baked into the portal build the portal project tests (nothing listens there). */
export const PORTAL_API_BASE = 'https://api.typefight.test';

/** The feedback address both builds get; the portal build must still not show the link. */
export const FEEDBACK_URL = 'https://feedback.typefight.test/form';

/** Provider ids for the builds that must show provider ads (or prove they never do). Not real ids. */
const ADSENSE_ENV = {
  VITE_ADSENSE_CLIENT: 'ca-pub-1234567890123456',
  VITE_ADSENSE_SLOT: '1234567890',
};

export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  reporter: process.env['CI'] ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    // The normal site, served by the dev server.
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: ['**/portal.spec.ts', '**/adProvider.spec.ts'] },
    // The site built with an ad provider configured (its script is stubbed by the tests).
    {
      name: 'adprovider',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:5180' },
      testMatch: '**/adProvider.spec.ts',
    },
    // The CrazyGames build, served as the portal would serve it (built, relative paths, SDK stubbed).
    {
      name: 'portal',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4173' },
      testMatch: ['**/portal.spec.ts', '**/feedback.spec.ts', '**/ads.spec.ts'],
    },
  ],
  webServer: [
    {
      command: 'npm run dev -w @typefight/web',
      env: { VITE_FEEDBACK_URL: FEEDBACK_URL, VITE_AD_PLACEHOLDERS: 'true' },
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env['CI'],
    },
    {
      command: 'npm run dev -w @typefight/web -- --port 5180 --strictPort',
      env: { ...ADSENSE_ENV, VITE_FEEDBACK_URL: FEEDBACK_URL, VITE_AD_PLACEHOLDERS: 'true' },
      url: 'http://localhost:5180',
      reuseExistingServer: !process.env['CI'],
    },
    {
      command:
        'npm run build:crazygames && npm run preview -w @typefight/web -- --outDir dist-crazygames --port 4173 --strictPort',
      url: 'http://localhost:4173',
      reuseExistingServer: !process.env['CI'],
      env: {
        VITE_API_BASE: PORTAL_API_BASE,
        VITE_FEEDBACK_URL: FEEDBACK_URL,
        VITE_AD_PLACEHOLDERS: 'true',
        // Even with provider ids the portal build must not use them.
        ...ADSENSE_ENV,
      },
      timeout: 120_000,
    },
  ],
});
