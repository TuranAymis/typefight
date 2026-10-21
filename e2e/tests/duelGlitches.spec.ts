import { test, expect, type Page } from '@playwright/test';
import type { GlitchEffect, KeyEvent, SessionRecord } from '@typefight/engine';
import GLITCH_CONFIG from '../../packages/texts/src/glitch.json' with { type: 'json' };
import { OVERCLOCK_SCENARIO } from './support/glitchScenario';
import { mockPlayer, startBody } from './support/duelMocks';
import { openDuel } from './support/navigation';

const TEXT = OVERCLOCK_SCENARIO.text;
const setup = async (page: Page, effect: GlitchEffect, ghostKeys = 'noise ') => {
  await mockPlayer(page);
  const glitch = {
    version: 1,
    markers: [{ id: 0, wordIndex: 0, charIndex: 0, effect, string: 'noise' }],
  };
  const ghost: SessionRecord = {
    version: 1,
    locale: 'en',
    targetText: TEXT,
    glitch,
    events: [...ghostKeys].map((key, index) => ({ key, t: (index + 1) * 100 })),
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
  let official: typeof OVERCLOCK_SCENARIO.outcome | undefined;
  await page.route('**/api/duel/submit', async (route) => {
    const submitted = route.request().postDataJSON() as { events: KeyEvent[]; durationMs: number };
    expect(submitted.events.map(({ key }) => key).join('')).toBe(OVERCLOCK_SCENARIO.playerKeys);
    official = OVERCLOCK_SCENARIO.outcome;
    await route.fulfill({
      json: {
        verified: true,
        result: { wpm: 30, accuracy: 100 },
        duel: {
          ...official,
          winner: 'opponent',
          rating: { before: 1000, after: 1000, delta: 0 },
          ratingApplied: true,
        },
      },
    });
  });
  await page.goto('/');
  await page.locator('#nav-to-nickname').click();
  await page.locator('#nickname-input').fill('Ada');
  await page.locator('#nickname-save').click();
  await openDuel(page);
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
  await page.locator('#duel-find').click();
  await expect(page.locator('#duel-opponent-name')).toBeVisible();
  await page.clock.runFor(1500);
  for (let second = 0; second < 3; second += 1) await page.clock.runFor(1000);
  await expect(page.locator('#duel-hud')).toBeVisible();
  return { ghost, result: () => official };
};

for (const effect of ['scramble', 'blackout', 'static'] as const) {
  test(`ghost ${effect} starts once, preserves accessible text, and clears all visual state`, async ({
    page,
  }) => {
    await setup(page, effect);
    const window = page.locator('#duel-visual-effects');
    const stream = page.locator('#duel-stream');
    const baseClass = await window.getAttribute('class');
    await page.clock.runFor(576);
    await expect(page.locator(`[data-effect="${effect}"]`)).toHaveCount(0);
    await page.clock.runFor(48);
    await expect(page.locator(`[data-effect="${effect}"]`)).toBeVisible();
    await expect(page.locator('#duel-glitch-feedback')).toHaveText(
      `${effect.toUpperCase()} glitch hit you`,
    );
    await expect(stream).toHaveAttribute('aria-label', TEXT);
    if (effect === 'scramble') {
      await expect(stream.locator('[class*="visual-char"]')).toHaveCount(5);
      expect(await stream.locator('[class*="visual-char"]').allTextContents()).toEqual([
        ...'ahpla',
      ]);
    } else await expect(window).not.toHaveAttribute('class', baseClass!);
    if (effect === 'static') {
      const expected = { hp: { a: 95 } };
      await expect(page.locator('#hp-player')).toHaveAttribute(
        'aria-valuenow',
        String(expected.hp.a),
      );
      expect(await window.evaluate((element) => getComputedStyle(element).animationDuration)).toBe(
        '1s',
      );
    }
    await page.clock.runFor(GLITCH_CONFIG.durationMs[effect] - 48);
    await expect(page.locator(`[data-effect="${effect}"]`)).toHaveCount(1);
    await page.clock.runFor(48);
    await expect(page.locator(`[data-effect="${effect}"]`)).toHaveCount(0);
    await expect(window).toHaveAttribute('class', baseClass!);
    await expect(window).not.toHaveAttribute('style');
    await expect(stream.locator('[class*="visual-char"], [class*="real-char"]')).toHaveCount(0);
    await page.clock.runFor(1000);
    await expect(page.locator(`[data-effect="${effect}"]`)).toHaveCount(0);
  });
}

test('reduced motion keeps static effect markers without shaking, obscuring or shuffled letters', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await setup(page, 'static');
  await page.clock.runFor(624);
  const window = page.locator('#duel-visual-effects');
  await expect(page.locator('[data-effect="static"]')).toBeVisible();
  expect(await window.evaluate((element) => getComputedStyle(element).animationName)).toBe('none');
  expect(await window.evaluate((element) => getComputedStyle(element, '::before').display)).toBe(
    'none',
  );
  await expect(page.locator('#duel-stream')).toHaveAttribute('aria-label', TEXT);
});

test('overclock badges cover three words and live HP agrees with the authoritative result', async ({
  page,
}) => {
  const { result } = await setup(page, 'overclock', 'noise alpha beta gamma delta ');
  await page.clock.runFor(624);
  await expect(page.locator('[data-effect="overclock"]')).toContainText('3 words');
  await page.keyboard.type('noise ');
  await page.clock.runFor(32);
  await expect(page.locator('#duel-glitch-feedback')).toHaveText('OVERCLOCK glitch sent');
  await expect(page.locator('#duel-stream [class*="multiplier"]')).toHaveCount(3);
  for (const [word, remaining] of [
    ['alpha ', 2],
    ['beta ', 1],
    ['gamma ', 0],
  ] as const) {
    await page.keyboard.type(word);
    await page.clock.runFor(32);
    await expect(page.locator('#duel-stream [class*="multiplier"]')).toHaveCount(remaining);
  }
  await page.clock.runFor(4000);
  await expect(page.locator('[data-effect="overclock"]')).toHaveCount(0);
  const playerHp = await page.locator('#hp-player').getAttribute('aria-valuenow');
  const ghostHp = await page.locator('#hp-opponent').getAttribute('aria-valuenow');
  await page.clock.fastForward(60000);
  await expect(page.locator('#duel-result-title')).toBeVisible();
  expect(result()?.hp).toEqual({ a: Number(playerHp), b: Number(ghostHp) });
  expect(result()?.hp.a).toBeLessThan(70);
});

test('a corrected glitch typo displays one penalty and never sends an effect', async ({ page }) => {
  await setup(page, 'blackout', '');
  await page.keyboard.type('x');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('noise ');
  await page.clock.runFor(32);
  await expect(page.locator('#duel-glitch-feedback')).toHaveText('Glitch penalty: -3 HP');
  await expect(page.locator('#hp-player')).toHaveAttribute('aria-valuenow', '97');
  await expect(page.locator('[data-effect]')).toHaveCount(0);
  await page.clock.runFor(1000);
  await expect(page.locator('#hp-player')).toHaveAttribute('aria-valuenow', '97');
});

for (const effect of ['scramble', 'blackout'] as const) {
  test(`reduced motion replaces ${effect} with a static marker`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await setup(page, effect);
    await page.clock.runFor(624);
    await expect(page.locator(`[data-effect="${effect}"]`)).toBeVisible();
    if (effect === 'scramble') {
      await expect(page.locator('[class*="visual-char"]').first()).toBeHidden();
      await expect(page.locator('[class*="real-char"]').first()).toBeVisible();
    } else {
      expect(
        await page
          .locator('#duel-visual-effects')
          .evaluate((element) => getComputedStyle(element, '::after').display),
      ).toBe('none');
    }
  });
}

test('blackout covers the visible window while the cursor stays centered after scrolling', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await setup(page, 'blackout');
  await page.clock.runFor(624);
  await page.keyboard.type('noise alpha beta gamma delta ');
  await page.clock.runFor(400);
  const geometry = await page.locator('#duel-window').evaluate((element) => {
    const cursor = element.querySelector('[data-cursor]')!;
    const bounds = element.getBoundingClientRect();
    const current = cursor.getBoundingClientRect();
    return { scroll: element.scrollTop, top: current.top - bounds.top, height: bounds.height };
  });
  expect(geometry.scroll).toBeGreaterThan(0);
  expect(geometry.top).toBeGreaterThan(0);
  expect(geometry.top).toBeLessThan(geometry.height * 0.7);
  const overlay = await page.locator('#duel-visual-effects').evaluate((element) => ({
    height: parseFloat(getComputedStyle(element, '::after').height),
    width: parseFloat(getComputedStyle(element, '::after').width),
    bounds: element.getBoundingClientRect().width,
  }));
  expect(overlay.height).toBeCloseTo(geometry.height, 0);
  expect(overlay.width).toBeCloseTo(overlay.bounds / 2, 0);
});

test('each glitch fired in a duel is recorded once as glitch_fired with only the duel source', async ({
  page,
}) => {
  const sent: { events: { name: string; props: Record<string, string> }[] }[] = [];
  await page.route('**/api/events', async (route) => {
    sent.push(route.request().postDataJSON() as (typeof sent)[number]);
    await route.fulfill({ status: 202, json: { accepted: 1 } });
  });
  await setup(page, 'static');
  const glitchEvents = () =>
    sent.flatMap((body) => body.events).filter((event) => event.name === 'glitch_fired');
  // The ghost fires at 600 ms: the batch is sent after the 2 s analytics delay.
  await page.clock.runFor(3000);
  // The batch is sent after an async (real-time) read of the device id, so wait for it to arrive.
  await expect.poll(() => glitchEvents().map((event) => event.props)).toEqual([{ source: 'duel' }]);
  await page.keyboard.type('noise ');
  await page.clock.runFor(3000);
  await expect
    .poll(() => glitchEvents().map((event) => event.props))
    .toEqual([{ source: 'duel' }, { source: 'duel' }]);
  // Nothing re-fires while the effects expire and the clock keeps running.
  await page.clock.runFor(10000);
  expect(glitchEvents()).toHaveLength(2);
  expect(JSON.stringify(sent)).not.toContain('noise');
});
