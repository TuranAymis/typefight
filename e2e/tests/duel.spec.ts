import { expect, test, type Page } from '@playwright/test';

import { DUEL_SCENARIOS, SCENARIO_TEXT } from './support/duelScenarios';
import { TEXT, ghostRecord, startBody, mockPlayer, press } from './support/duelMocks';
import { openDuel } from './support/navigation';

test('duel flow: find opponent, countdown, fight with live HP, result, rematch and new opponent', async ({
  page,
}) => {
  await mockPlayer(page);
  const startBodies: Record<string, unknown>[] = [];
  const submissions: { events: { t: number; key: string }[]; durationMs: number }[] = [];
  await page.route('**/api/duel/start', async (route) => {
    startBodies.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify(startBody(startBodies.length === 1)),
    });
  });
  await page.route('**/api/duel/submit', async (route) => {
    submissions.push(route.request().postDataJSON() as (typeof submissions)[number]);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        sessionId: 's1',
        verified: true,
        newBadges: [{ id: 'first-win', name: 'First Win' }],
        result: { wpm: 80, accuracy: 100 },
        duel: {
          winner: 'player',
          reason: 'hp',
          hp: { a: 100, b: 71 },
          endedAt: 60000,
          rating: { before: 1000, after: 1016, delta: 16 },
          ratingApplied: true,
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

  // Match found shows the bot label, then 3-2-1.
  await expect(page.locator('#duel-opponent-name')).toHaveText('[BOT] 30 WPM');
  await expect(page.locator('#duel-opponent-info')).toContainText('Training bot');
  await expect(page.locator('#duel-countdown')).toBeVisible();
  await expect(page.locator('#duel-hud')).toBeVisible({ timeout: 8000 });
  await expect(page.locator('#hp-player')).toHaveAttribute('aria-valuenow', '100');
  await expect(page.locator('#hp-opponent')).toHaveAttribute('aria-valuenow', '100');

  await page.locator('[role=textbox]').focus();
  await page.keyboard.type('the quick ', { delay: 40 });
  await expect(page.locator('#hp-opponent')).not.toHaveAttribute('aria-valuenow', '100');
  await expect(page.locator('#duel-combo')).toContainText('x2');
  await page.keyboard.type('brown fox jumps over the lazy dog', { delay: 40 });

  await expect(page.locator('#duel-result-title')).toHaveText('Victory');
  await expect(page.locator('#duel-new-badges')).toContainText('First Win');
  await expect(page.locator('#duel-result-rating')).toContainText('1000 → 1016 (+16)');
  expect(submissions).toHaveLength(1);
  expect(submissions[0]?.events.map((event) => event.key).join('')).toBe(TEXT);
  expect(submissions[0]?.durationMs).toBeGreaterThan(
    submissions[0]?.events.at(-1)?.t ?? Infinity - 1,
  );

  await page.locator('#duel-rematch').click();
  await expect(page.locator('#duel-opponent-name')).toHaveText('Rival');
  expect(startBodies[1]).toEqual({ lang: 'en', rematchSessionId: 'ghost-1' });
});

test('duel shows an error with retry when the server is down', async ({ page }) => {
  await mockPlayer(page);
  let down = true;
  await page.route('**/api/duel/start', async (route) => {
    if (down) await route.abort();
    else {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(startBody(false)),
      });
    }
  });
  await page.goto('/');
  await page.locator('#nav-to-nickname').click();
  await page.locator('#nickname-input').fill('Ada');
  await page.locator('#nickname-save').click();
  await openDuel(page);
  await page.locator('#duel-find').click();
  await expect(page.locator('#duel-error')).toContainText('Could not reach');
  down = false;
  await page.locator('#duel-retry').click();
  await expect(page.locator('#duel-opponent-name')).toHaveText('Rival');
});

test('duel accepts Turkish letters and records typo corrections as Backspace', async ({ page }) => {
  const turkish = 'şu güzel çocuk ığ';
  await mockPlayer(page);
  await page.route('**/api/duel/start', async (route) => {
    const body = startBody(true);
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        ...body,
        lang: 'tr',
        text: turkish,
        opponent: {
          ...body.opponent,
          record: { ...ghostRecord(500), targetText: turkish, locale: 'tr' },
        },
      }),
    });
  });
  let submitted: { events: { key: string }[] } | undefined;
  await page.route('**/api/duel/submit', async (route) => {
    submitted = route.request().postDataJSON() as typeof submitted;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        verified: true,
        result: { wpm: 40, accuracy: 94 },
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
  await page.locator('#nav-to-nickname').click();
  await page.locator('#nickname-input').fill('Ada');
  await page.locator('#nickname-save').click();
  await openDuel(page);
  await page.locator('#duel-lang-tr').click();
  await page.locator('#duel-find').click();
  await expect(page.locator('#duel-hud')).toBeVisible({ timeout: 8000 });

  await page.locator('[role=textbox]').focus();
  // Playwright cannot press non-US letters, so dispatch real keydown events on the typing area.
  await press(page, [...'şu g']);
  await press(page, ['x', 'Backspace']);
  await press(page, [...'üzel çocuk ığ']);

  await expect(page.locator('#duel-result-title')).toHaveText('Draw');
  const keys = submitted?.events.map((event) => event.key) ?? [];
  expect(keys).toContain('Backspace');
  expect(keys.filter((key) => key !== 'Backspace' && key !== 'x').join('')).toBe(turkish);
});

const enterFight = async (page: Page) => {
  await page.goto('/');
  await page.locator('#nav-to-nickname').click();
  await page.locator('#nickname-input').fill('Ada');
  await page.locator('#nickname-save').click();
  await openDuel(page);
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
  await page.locator('#duel-find').click();
  await expect(page.locator('#duel-opponent-name')).toHaveText('Rival');
  await page.clock.runFor(1500);
  await expect(page.locator('#duel-countdown')).toBeVisible();
  for (let second = 0; second < 3; second += 1) await page.clock.runFor(1000);
  await expect(page.locator('#duel-hud')).toBeVisible();
};

for (const scenario of DUEL_SCENARIOS) {
  test(`duel ${scenario.name}: replay, submission and authoritative server result`, async ({
    page,
  }) => {
    await mockPlayer(page);
    await page.route('**/api/duel/start', async (route) => {
      const body = startBody(false);
      await route.fulfill({
        status: 201,
        json: { ...body, opponent: { ...body.opponent, rating: 1000, record: scenario.ghost } },
      });
    });
    const submissions: { events: { t: number; key: string }[]; durationMs: number }[] = [];
    await page.route('**/api/duel/submit', async (route) => {
      submissions.push(route.request().postDataJSON() as (typeof submissions)[number]);
      await route.fulfill({
        json: {
          verified: true,
          result: { wpm: 80, accuracy: 100 },
          duel: {
            winner: scenario.winner,
            reason: scenario.reason,
            hp: scenario.hp,
            endedAt: 60000,
            rating: { before: 1000, after: 1000 + scenario.delta, delta: scenario.delta },
            ratingApplied: true,
          },
        },
      });
    });
    await enterFight(page);
    let elapsed = 0;
    for (const event of scenario.player.events) {
      await page.clock.runFor(event.t - elapsed);
      if (scenario.winner === 'player' && event === scenario.player.events.at(-1)) {
        // Last visible HUD before completion: the server will also replay future ghost damage.
        await expect(page.locator('#hp-player')).toHaveAttribute('aria-valuenow', '91');
        await expect(page.locator('#hp-opponent')).toHaveAttribute('aria-valuenow', '56');
      }
      await page.keyboard.press(event.key === ' ' ? 'Space' : event.key);
      elapsed = event.t;
    }
    if (scenario.winner === 'opponent') {
      // A stopped player loses on the time limit, without completing the target.
      await page.clock.fastForward(59000 - elapsed);
      await expect(page.locator('#duel-timer')).toHaveText('1');
      await expect(page.locator('#hp-player')).toHaveAttribute(
        'aria-valuenow',
        String(scenario.hp.a),
      );
      await expect(page.locator('#hp-opponent')).toHaveAttribute(
        'aria-valuenow',
        String(scenario.hp.b),
      );
      await page.clock.runFor(1032);
      await expect(page.getByText('More HP when time ran out', { exact: true })).toBeVisible();
    } else {
      // The last key is published on the next animation frame.
      await page.clock.runFor(32);
    }
    await expect(page.locator('#duel-result-title')).toHaveText(scenario.title);
    await expect(page.locator('#duel-result-title')).toHaveAttribute(
      'data-winner',
      scenario.winner,
    );
    await expect(page.locator('#duel-result-rating')).toHaveText(
      `Rating 1000 → ${1000 + scenario.delta} (${scenario.delta > 0 ? '+' : ''}${scenario.delta})`,
    );
    await expect(page.locator('#duel-result-detail')).toContainText(
      `You ${scenario.hp.a} HP · Rival ${scenario.hp.b} HP`,
    );
    expect(submissions).toHaveLength(1);
    const submission = submissions[0]!;
    expect(submission.events).toEqual(scenario.player.events);
    expect(submission.durationMs).toBe(scenario.player.durationMs);
    expect(submission.events.map(({ key }) => key).join('')).toBe(
      scenario.winner === 'player' ? SCENARIO_TEXT : 'the ',
    );
    for (let index = 1; index < submission.events.length; index += 1) {
      expect(submission.events[index]!.t).toBeGreaterThan(submission.events[index - 1]!.t);
    }
  });
}

test('idle player sees ghost replay advance at its recorded times and reach the end', async ({
  page,
}) => {
  await mockPlayer(page);
  const ghost = DUEL_SCENARIOS[1].ghost;
  await page.route('**/api/duel/start', async (route) => {
    const body = startBody(false);
    await route.fulfill({
      status: 201,
      json: { ...body, opponent: { ...body.opponent, record: ghost } },
    });
  });
  await enterFight(page);
  let previous = -1;
  let elapsed = 0;
  for (const time of [400, 800, 1600, ghost.durationMs + 32]) {
    await page.clock.runFor(time - elapsed);
    elapsed = time;
    // rAF publishes every 16ms; samples stay away from event boundaries.
    const count = ghost.events.filter(({ t }) => t <= Math.floor(time / 16) * 16).length;
    await expect(
      page.getByText(`Ghost: Rival is at ${count}/${SCENARIO_TEXT.length}`, { exact: true }),
    ).toBeVisible();
    const width = await page
      .locator('#ghost-progress')
      .evaluate((element) => parseFloat((element as HTMLElement).style.width));
    expect(width).toBeCloseTo((count / SCENARIO_TEXT.length) * 100);
    expect(width).toBeGreaterThan(previous);
    previous = width;
  }
  expect(previous).toBe(100);
  await expect(page.locator('#duel-result-title')).toHaveCount(0);
});

// Glitch scenarios (SCRAMBLE, BLACKOUT, STATIC, OVERCLOCK, penalty, reduced motion) live in duelGlitches.spec.ts.
