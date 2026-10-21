import { test, expect } from './support/regression';
import { openDuel, registerNickname } from './support/navigation';
import ONBOARDING from '../../packages/texts/src/onboarding.json' with { type: 'json' };

for (const [screen, back] of [
  ['simulator', 'nav-sim-to-menu'],
  ['gauntlet', 'nav-gauntlet-to-menu'],
  ['results', 'nav-results-to-menu'],
  ['nickname', 'nickname-cancel'],
  ['profile', 'profile-back'],
] as const) {
  test(`${screen} menu entry and return retain content focus without console errors`, async ({
    page,
  }) => {
    await page.goto('/');
    if (screen === 'profile') await registerNickname(page);
    await page.locator(`#nav-to-${screen}`).click();
    await expect(page.locator(`#screen-${screen}`)).toBeVisible();
    await expect(
      screen === 'simulator' ? page.getByRole('textbox') : page.locator('#main-content'),
    ).toBeFocused();
    await page.locator(`#${back}`).click();
    await expect(page.locator('#screen-menu')).toBeVisible();
    await expect(page.locator('#main-content')).toBeFocused();
  });
}

test('duel and how-to-play entries keep focus in content through skip and return', async ({
  page,
}) => {
  await page.goto('/');
  await registerNickname(page);
  await openDuel(page);
  await expect(page.locator('#main-content')).toBeFocused();
  await page.locator('#duel-back').click();
  await expect(page.locator('#main-content')).toBeFocused();
  await page.locator('#nav-to-onboarding').click();
  await expect(page.getByRole('textbox')).toBeFocused();
  await page.locator('#onboarding-skip').click();
  await expect(page.locator('#duel-find')).toBeVisible();
  await expect(page.locator('#main-content')).toBeFocused();
  await page.locator('#duel-back').click();
  await expect(page.locator('#screen-menu')).toBeVisible();
  await expect(page.locator('#main-content')).toBeFocused();
});

test('tutorial reduced motion replaces the scripted glitch animation with a static cue', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install();
  await page.goto('/');
  await page.locator('#nav-to-onboarding').click();
  await page.keyboard.type(
    ONBOARDING.segments
      .slice(0, 2)
      .map(({ text }) => text)
      .join(''),
  );
  await expect(page.locator('#tutorial-caption')).toHaveText(ONBOARDING.demoLabel);
  const distorted = page.locator('#screen-onboarding [class*="distorted"]');
  await expect(distorted.first()).toBeVisible();
  expect(
    await distorted.evaluateAll((elements) =>
      elements.every((element) => {
        const style = getComputedStyle(element);
        return (
          style.animationName === 'none' &&
          style.textShadow === 'none' &&
          style.borderBottomStyle === 'dashed'
        );
      }),
    ),
  ).toBe(true);
  await page.clock.runFor(ONBOARDING.glitchDurationMs + 100);
  await expect(distorted).toHaveCount(0);
  await expect(page.getByRole('textbox')).toBeFocused();
});
