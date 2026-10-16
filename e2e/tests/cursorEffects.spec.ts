import { expect, test } from '@playwright/test';
import { openDuel } from './support/navigation';

for (const effectId of ['pulse', 'neon-trail', 'ember']) {
  test(`${effectId}: saves an unlocked effect and uses it in simulator and duel`, async ({
    page,
  }) => {
    let selected = 'default';
    let failSave = true;
    const badgeId = { pulse: 'first-win', 'neon-trail': 'wpm-75', ember: 'accuracy-99' }[effectId];
    await page.route('**/api/player', (route) =>
      route.fulfill({
        status: 201,
        json: { playerId: 'p1', nickname: 'Ada', deviceToken: 'a'.repeat(64) },
      }),
    );
    await page.route('**/api/profile/p1', (route) =>
      route.fulfill({
        json: {
          playerId: 'p1',
          nickname: 'Ada',
          rating: 1000,
          sessions: 1,
          bestWpm: 80,
          averageAccuracy: 99,
          duels: { played: 1, won: 1, lost: 0, drawn: 0 },
          badges: [{ id: badgeId, earnedAt: 1 }],
          cursorEffect: selected,
        },
      }),
    );
    await page.route('**/api/player/cursor-effect', async (route) => {
      expect(route.request().method()).toBe('PUT');
      expect(route.request().headers()['authorization']).toBe(`Bearer ${'a'.repeat(64)}`);
      expect(route.request().postDataJSON()).toEqual({ effectId });
      if (failSave) {
        await route.fulfill({ status: 500, json: { error: 'server' } });
      } else {
        selected = effectId;
        await route.fulfill({ json: { effectId } });
      }
    });
    const text = 'the quick brown fox jumps over the lazy dog';
    await page.route('**/api/duel/start', (route) =>
      route.fulfill({
        status: 201,
        json: {
          sessionId: 's1',
          sessionToken: 't'.repeat(64),
          mode: 'duel',
          lang: 'en',
          textId: 'en-001',
          text,
          seed: 1,
          opponent: {
            sessionId: 'ghost',
            nickname: 'Rival',
            rating: 1000,
            isBot: false,
            wpm: 30,
            record: {
              version: 1,
              targetText: text,
              locale: 'en',
              events: [...text].map((key, index) => ({ key, t: (index + 1) * 400 })),
              durationMs: 20000,
            },
          },
        },
      }),
    );

    await page.goto('/');
    await page.locator('#nav-to-nickname').click();
    await page.locator('#nickname-input').fill('Ada');
    await page.locator('#nickname-save').click();
    await page.locator('#nav-to-profile').click();
    await expect(page.locator('[data-effect-option]')).toHaveCount(4);
    const lockedId = effectId === 'pulse' ? 'ember' : 'pulse';
    await expect(page.locator(`[data-effect-option="${lockedId}"]`)).toBeDisabled();
    await expect(page.locator(`[data-effect-option="${lockedId}"]`)).toContainText('Requires');
    const option = page.locator(`[data-effect-option="${effectId}"]`);
    await option.click();
    await expect(page.getByRole('alert')).toContainText('Could not save');
    await expect(page.locator('[data-effect-option="default"]')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    failSave = false;
    await option.click();
    await expect(option).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#profile-back').click();
    await page.locator('#nav-to-simulator').click();
    await expect(page.getByRole('textbox')).toHaveAttribute('data-cursor-effect', effectId);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(
      await page
        .locator('[data-cursor]')
        .evaluate((element) => getComputedStyle(element).animationName),
    ).toBe('none');
    expect(
      await page
        .locator('[data-cursor]')
        .evaluate((element) => getComputedStyle(element, '::after').animationName),
    ).toBe('none');
    await page.locator('#nav-sim-to-menu').click();

    // Reload restores the selection from the API without opening the profile.
    await page.reload();
    await page.locator('#nav-to-simulator').click();
    await expect(page.getByRole('textbox')).toHaveAttribute('data-cursor-effect', effectId);
    await page.locator('#nav-sim-to-menu').click();
    await openDuel(page);
    await page.locator('#duel-find').click();
    await expect(page.getByRole('textbox')).toHaveAttribute('data-cursor-effect', effectId, {
      timeout: 8000,
    });
  });
}

test('startup profile failure silently uses the default effect', async ({ page }) => {
  await page.route('**/api/player', (route) =>
    route.fulfill({
      status: 201,
      json: { playerId: 'p1', nickname: 'Ada', deviceToken: 'a'.repeat(64) },
    }),
  );
  await page.route('**/api/profile/p1', (route) => route.abort());
  await page.goto('/');
  await page.locator('#nav-to-nickname').click();
  await page.locator('#nickname-input').fill('Ada');
  await page.locator('#nickname-save').click();
  await page.reload();
  await page.locator('#nav-to-simulator').click();
  await expect(page.getByRole('textbox')).toHaveAttribute('data-cursor-effect', 'default');
  await expect(page.getByRole('alert')).toHaveCount(0);
});
