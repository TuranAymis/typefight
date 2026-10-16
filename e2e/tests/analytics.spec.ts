import { expect, test, type Page } from '@playwright/test';
import { TEXT, mockPlayer, startBody } from './support/duelMocks';
import { openDuel, registerNickname } from './support/navigation';

interface Sent {
  clientId: string;
  events: { name: string; props: Record<string, string> }[];
}

/** Records every POST to /api/events and answers 202 like the real API. */
const captureEvents = async (page: Page) => {
  const bodies: Sent[] = [];
  await page.route('**/api/events', async (route) => {
    bodies.push(route.request().postDataJSON() as Sent);
    await route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify({ accepted: 1 }),
    });
  });
  return {
    bodies,
    names: () => bodies.flatMap((body) => body.events.map((event) => event.name)),
    all: () => bodies.flatMap((body) => body.events),
  };
};

const mockDuel = async (page: Page, winner: 'player' | 'opponent' | 'draw' = 'player') => {
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
          hp: { a: 100, b: 20 },
          endedAt: 60000,
          rating: { before: 1000, after: 1010, delta: 10 },
          ratingApplied: true,
        },
      }),
    });
  });
};

const playDuel = async (page: Page) => {
  await page.locator('#duel-find').click();
  await expect(page.locator('#duel-hud')).toBeVisible({ timeout: 8000 });
  await page.locator('[role=textbox]').focus();
  await page.keyboard.type(TEXT, { delay: 30 });
  await expect(page.locator('#duel-result-title')).toBeVisible();
};

test('opening the game records one game_open with an anonymous client id', async ({ page }) => {
  const events = await captureEvents(page);
  await page.goto('/');
  await expect.poll(() => events.names(), { timeout: 8000 }).toEqual(['game_open']);
  expect(events.bodies[0]?.clientId).toMatch(/^[0-9a-f]{32}$/);
  expect(events.all()[0]?.props).toEqual({});
});

test('the same browser keeps its client id across reloads', async ({ page }) => {
  const events = await captureEvents(page);
  await page.goto('/');
  await expect.poll(() => events.bodies.length, { timeout: 8000 }).toBe(1);
  await page.reload();
  await expect.poll(() => events.bodies.length, { timeout: 8000 }).toBe(2);
  expect(events.bodies[1]?.clientId).toBe(events.bodies[0]?.clientId);
  expect(events.names()).toEqual(['game_open', 'game_open']);
});

test('a simulator run records sim_started once and sim_completed when finished', async ({
  page,
}) => {
  const events = await captureEvents(page);
  await page.goto('/');
  await page.locator('#nav-to-simulator').click();
  const text = (await page.locator('#typing-stream').innerText())
    .replace(/␣/g, ' ')
    .replace(/\s+/g, ' ');
  await page.locator('[role=textbox]').focus();
  await page.keyboard.type(text.trim(), { delay: 5 });
  await expect(page.locator('#stat-position')).toContainText(`${text.trim().length} /`);
  await expect
    .poll(() => events.names().filter((name) => name.startsWith('sim_')), { timeout: 8000 })
    .toEqual(['sim_started', 'sim_completed']);
  const sim = events.all().filter((event) => event.name.startsWith('sim_'));
  expect(sim.map((event) => event.props)).toEqual([{ lang: 'en' }, { lang: 'en' }]);
});

test('a duel records duel_started, duel_completed and rematch with schema-only properties', async ({
  page,
}) => {
  const events = await captureEvents(page);
  await mockDuel(page, 'player');
  await page.goto('/');
  await registerNickname(page);
  await openDuel(page);
  await playDuel(page);

  await page.locator('#duel-rematch').click();
  await expect(page.locator('#duel-opponent-name')).toBeVisible();
  await expect
    .poll(
      () =>
        events
          .names()
          .filter((name) => ['duel_started', 'duel_completed', 'rematch'].includes(name)),
      { timeout: 8000 },
    )
    .toEqual(['duel_started', 'duel_completed', 'rematch']);

  const byName = (name: string) => events.all().find((event) => event.name === name)?.props;
  expect(byName('duel_started')).toEqual({ lang: 'en', opponent: 'bot' });
  expect(byName('duel_completed')).toEqual({ lang: 'en', winner: 'player', reason: 'hp' });
  expect(byName('rematch')).toEqual({ lang: 'en' });
});

test('the tutorial glitch demo records glitch_fired from the tutorial', async ({ page }) => {
  const events = await captureEvents(page);
  await page.goto('/');
  await page.locator('#nav-to-onboarding').click();
  await page.locator('[role=textbox]').focus();
  await page.keyboard.type('find your rhythm each word lands a hit stay calm and keep typing', {
    delay: 15,
  });
  await expect(page.locator('#onboarding-start-duel')).toBeVisible();
  await expect
    .poll(() => events.names().filter((name) => name === 'glitch_fired'), { timeout: 8000 })
    .toEqual(['glitch_fired']);
  expect(events.all().find((event) => event.name === 'glitch_fired')?.props).toEqual({
    source: 'tutorial',
  });
});

test('no nickname, typed text or other personal data is ever sent', async ({ page }) => {
  const events = await captureEvents(page);
  await mockDuel(page, 'opponent');
  await page.goto('/');
  await registerNickname(page);
  await openDuel(page);
  await playDuel(page);
  await expect.poll(() => events.names().includes('duel_completed'), { timeout: 8000 }).toBe(true);

  const everything = JSON.stringify(events.bodies);
  expect(everything).not.toContain('Ada');
  expect(everything).not.toContain('quick brown');
  expect(everything).not.toContain('a'.repeat(64)); // the player's device token
  for (const body of events.bodies)
    expect(Object.keys(body).sort()).toEqual(['clientId', 'events']);
});

test('Do Not Track: nothing is sent and no client id is created', async ({ page }) => {
  const events = await captureEvents(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'doNotTrack', { value: '1', configurable: true });
  });
  await mockDuel(page, 'player');
  await page.goto('/');
  await registerNickname(page);
  await openDuel(page);
  await playDuel(page);
  await page.waitForTimeout(3000); // longer than the send delay
  expect(events.bodies).toEqual([]);

  const stored = await page.evaluate(
    () =>
      new Promise<unknown>((resolve) => {
        const request = indexedDB.open('typefight');
        request.onsuccess = () => {
          const get = request.result
            .transaction('identity')
            .objectStore('identity')
            .get('analyticsClientId');
          get.onsuccess = () => resolve(get.result ?? null);
          get.onerror = () => resolve('error');
        };
        request.onerror = () => resolve('error');
      }),
  );
  expect(stored).toBeNull();
});

test('the game works when the events endpoint is down', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/api/events', (route) => route.abort());
  await page.goto('/');
  await page.locator('#nav-to-simulator').click();
  await page.locator('[role=textbox]').focus();
  await page.keyboard.type('the quick', { delay: 20 });
  await expect(page.locator('#stat-position')).toContainText('9 /');
  await page.waitForTimeout(2500);
  expect(errors).toEqual([]);
});
