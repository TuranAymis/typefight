import { defineConfig, devices } from '@playwright/test';

/** The API address baked into the portal build the portal project tests (nothing listens there). */
export const PORTAL_API_BASE = 'https://api.typefight.test';

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
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: '**/portal.spec.ts' },
    // The CrazyGames build, served as the portal would serve it (built, relative paths, SDK stubbed).
    {
      name: 'portal',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4173' },
      testMatch: '**/portal.spec.ts',
    },
  ],
  webServer: [
    {
      command: 'npm run dev -w @typefight/web',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env['CI'],
    },
    {
      command:
        'npm run build:crazygames && npm run preview -w @typefight/web -- --outDir dist-crazygames --port 4173 --strictPort',
      url: 'http://localhost:4173',
      reuseExistingServer: !process.env['CI'],
      env: { VITE_API_BASE: PORTAL_API_BASE },
      timeout: 120_000,
    },
  ],
});
