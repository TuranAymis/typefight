import { defineConfig, devices } from '@playwright/test';

/** Records the gameplay clip for the release page (see e2e/media). Separate from the test suite. */
export default defineConfig({
  testDir: './e2e/media',
  outputDir: './media/raw',
  workers: 1,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://localhost:5173',
    viewport: { width: 960, height: 600 },
    video:
      process.env['CLIP_VIDEO'] === '1' ? { mode: 'on', size: { width: 960, height: 600 } } : 'off',
  },
  webServer: {
    command: 'npm run dev -w @typefight/web',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
});
