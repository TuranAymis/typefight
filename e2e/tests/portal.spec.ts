import { expect, test, type Page, type Route } from '@playwright/test';
import { TEXT, startBody } from './support/duelMocks';

// These tests run against the CrazyGames build (see the "portal" project in playwright.config.ts):
// built, relative asset paths, the portal SDK stubbed, and the API on another origin.
const API = 'https://api.typefight.test';
const SDK_URL = 'https://sdk.crazygames.com/crazygames-sdk-v2.js';

const STUB_SDK = `
  window.__cg = [];
  const log = (name) => () => { window.__cg.push(name); };
  window.CrazyGames = { SDK: {
    getEnvironment: async () => 'crazygames',
    game: {
      gameplayStart: log('gameplayStart'),
      gameplayStop: log('gameplayStop'),
      sdkGameLoadingStart: log('loadingStart'),
      sdkGameLoadingStop: log('loadingStop'),
      happytime: log('happytime'),
    },
  } };
`;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
};

const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({
    status,
    contentType: 'application/json',
    headers: CORS,
    body: JSON.stringify(body),
  });

/** Stubs the portal SDK and answers the API on its own origin, like a real cross-origin deployment. */
const setup = async (page: Page, options: { sdk?: boolean } = {}) => {
  const requests: { url: string; method: string }[] = [];
  const external: string[] = [];
  const sameOriginApi: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (url.startsWith('http://localhost:4173/api')) sameOriginApi.push(url);
    if (!url.startsWith('http://localhost:4173') && !url.startsWith('data:')) external.push(url);
  });
  if (options.sdk === false) await page.route(SDK_URL, (route) => route.abort());
  else {
    await page.route(SDK_URL, (route) =>
      route.fulfill({ status: 200, contentType: 'text/javascript', body: STUB_SDK }),
    );
  }
  await page.route(`${API}/**`, async (route) => {
    const request = route.request();
    requests.push({ url: request.url(), method: request.method() });
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS });
      return;
    }
    const path = new URL(request.url()).pathname;
    if (path === '/api/player') {
      return json(route, 201, {
        created: true,
        playerId: 'p1',
        nickname: 'Ada',
        deviceToken: 'a'.repeat(64),
      });
    }
    if (path === '/api/duel/start') return json(route, 201, startBody(true));
    if (path === '/api/duel/submit') {
      return json(route, 200, {
        sessionId: 's1',
        verified: true,
        newBadges: [],
        result: { wpm: 60, accuracy: 100 },
        duel: {
          winner: 'player',
          reason: 'hp',
          hp: { a: 100, b: 20 },
          endedAt: 60000,
          rating: { before: 1000, after: 1010, delta: 10 },
          ratingApplied: true,
        },
      });
    }
    if (path === '/api/events') return json(route, 202, { accepted: 1 });
    return json(route, 404, {});
  });
  return { requests, external, sameOriginApi };
};

const sdkCalls = (page: Page) =>
  page.evaluate(() => (window as unknown as { __cg: string[] }).__cg ?? []);

/** No event of the same kind twice in a row, which portals reject. */
const noConsecutiveRepeats = (calls: string[]) => {
  const gameplay = calls.filter((call) => call.startsWith('gameplay'));
  return gameplay.every((call, index) => index === 0 || call !== gameplay[index - 1]);
};

test('the build is portal-ready: SDK present, relative paths, marked document, no Google Fonts', async ({
  page,
}) => {
  const { external } = await setup(page);
  await page.goto('/');
  await expect(page.locator('#screen-menu')).toBeVisible();
  expect(await page.locator('html').getAttribute('data-portal')).toBe('crazygames');

  const html = await (await page.request.get('/')).text();
  expect(html).toContain(SDK_URL);
  expect(html).not.toMatch(/fonts\.(googleapis|gstatic)/);
  expect(html).toMatch(/src="\.\/assets\//);
  expect(html).not.toMatch(/(?:src|href)="\/assets/);

  // The only third-party host the page may touch is the portal SDK (stubbed here) and the API.
  const hosts = new Set(external.map((url) => new URL(url).host));
  for (const host of hosts) expect(['sdk.crazygames.com', 'api.typefight.test']).toContain(host);
});

test('loading is reported once, and ends when the first screen is on the page', async ({
  page,
}) => {
  await setup(page);
  await page.goto('/');
  await expect(page.locator('#screen-menu')).toBeVisible();
  expect(await sdkCalls(page)).toEqual(['loadingStart', 'loadingStop']);
});

test('a simulator run reports gameplay start and stop around the typing', async ({ page }) => {
  await setup(page);
  await page.goto('/');
  await page.locator('#nav-to-simulator').click();
  await expect(page.locator('#screen-simulator')).toBeVisible();
  expect(await sdkCalls(page)).not.toContain('gameplayStart'); // not on load, only on input

  const text = (await page.locator('#typing-stream').innerText()).replace(/␣/g, ' ').trim();
  await page.locator('[role=textbox]').focus();
  await page.keyboard.type(text.slice(0, 3), { delay: 10 });
  await expect.poll(() => sdkCalls(page)).toContain('gameplayStart');
  await page.keyboard.type(text.slice(3), { delay: 5 });
  await expect(page.locator('#stat-position')).toContainText(`${text.length} /`);
  const calls = await sdkCalls(page);
  expect(calls.filter((call) => call === 'gameplayStart')).toHaveLength(1);
  expect(calls.at(-1)).toBe('gameplayStop');
  expect(noConsecutiveRepeats(calls)).toBe(true);
});

test('a duel talks to the API on its own origin and reports gameplay and a celebration', async ({
  page,
}) => {
  const { requests, sameOriginApi } = await setup(page);
  await page.goto('/');
  await page.locator('#nav-to-nickname').click();
  await page.locator('#nickname-input').fill('Ada');
  await page.locator('#nickname-save').click();
  await page.locator('#nav-to-duel').click();
  await page.locator('#onboarding-skip').click();
  await page.locator('#duel-find').click();
  await expect(page.locator('#duel-hud')).toBeVisible({ timeout: 8000 });
  const startedBeforeTyping = await sdkCalls(page);
  expect(startedBeforeTyping.filter((call) => call === 'gameplayStart')).toHaveLength(1);

  await page.locator('[role=textbox]').focus();
  await page.keyboard.type(TEXT, { delay: 30 });
  await expect(page.locator('#duel-result-title')).toHaveText('Victory');

  const calls = await sdkCalls(page);
  expect(calls).toEqual([
    'loadingStart',
    'loadingStop',
    'gameplayStart',
    'gameplayStop',
    'happytime',
  ]);
  const paths = requests.map((request) => new URL(request.url).pathname);
  expect(paths).toContain('/api/player');
  expect(paths).toContain('/api/duel/start');
  expect(paths).toContain('/api/duel/submit');
  // Nothing went to the portal's own domain, where /api does not exist.
  expect(sameOriginApi).toEqual([]);
});

test('the game still works when the portal SDK is blocked', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await setup(page, { sdk: false });
  await page.goto('/');
  await page.locator('#nav-to-simulator').click();
  await page.locator('[role=textbox]').focus();
  await page.keyboard.type('the quick', { delay: 20 });
  await expect(page.locator('#stat-position')).toContainText('9 /');
  expect(errors).toEqual([]);
});

test('text selection is disabled on the portal page, but not in inputs', async ({ page }) => {
  await setup(page);
  await page.goto('/');
  const bodySelect = await page.evaluate(() => getComputedStyle(document.body).userSelect);
  expect(bodySelect).toBe('none');
  await page.locator('#nav-to-nickname').click();
  const inputSelect = await page.evaluate(
    () => getComputedStyle(document.querySelector('#nickname-input') as Element).userSelect,
  );
  expect(inputSelect).not.toBe('none');
});
