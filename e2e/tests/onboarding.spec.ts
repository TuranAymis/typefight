import { expect, test, type Page } from '@playwright/test';
import { mockPlayer, startBody } from './support/duelMocks';
import { registerNickname } from './support/navigation';

const TUTORIAL_TEXT = 'find your rhythm each word lands a hit stay calm and keep typing';

const mockDuelStart = async (page: Page) => {
  await mockPlayer(page);
  await page.route('**/api/duel/start', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify(startBody(true)),
    });
  });
};

const finishTutorial = async (page: Page) => {
  await page.locator('[role=textbox]').focus();
  await page.keyboard.type(TUTORIAL_TEXT, { delay: 15 });
};

test('a first-time player is taught in the tutorial, then reaches a real duel', async ({
  page,
}) => {
  await mockDuelStart(page);
  await page.goto('/');
  await registerNickname(page);
  await page.locator('#nav-to-duel').click();

  await expect(page.locator('#screen-onboarding')).toBeVisible();
  await expect(page.getByText('Type the glowing text')).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'Training dummy HP' })).toHaveAttribute(
    'aria-valuenow',
    '100',
  );

  await page.locator('[role=textbox]').focus();
  await page.keyboard.type('find your rhythm ', { delay: 15 });
  await expect(page.getByText('Every word hits your rival')).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'Training dummy HP' })).toHaveAttribute(
    'aria-valuenow',
    '76',
  );

  await page.keyboard.type('each word lands a hit ', { delay: 15 });
  await expect(page.getByText('Glitches scramble the screen. Keep typing!')).toBeVisible();
  await expect(page.getByText('Scripted glitch demo')).toBeVisible();

  await page.keyboard.type('stay calm and keep typing', { delay: 15 });
  await expect(page.getByRole('heading', { name: "You're ready!" })).toBeVisible();
  await page.locator('#onboarding-start-duel').click();
  await expect(page.locator('#duel-find')).toBeVisible();
});

test('the tutorial is shown once: a reload goes straight to the duel', async ({ page }) => {
  await mockDuelStart(page);
  await page.goto('/');
  await registerNickname(page);
  await page.locator('#nav-to-duel').click();
  await finishTutorial(page);
  await expect(page.locator('#onboarding-start-duel')).toBeVisible();

  await page.reload();
  await page.locator('#nav-to-duel').click();
  await expect(page.locator('#duel-find')).toBeVisible();
  await expect(page.locator('#screen-onboarding')).toHaveCount(0);
});

test('skip leaves the tutorial immediately and remembers the choice', async ({ page }) => {
  await mockDuelStart(page);
  await page.goto('/');
  await registerNickname(page);
  await page.locator('#nav-to-duel').click();
  await page.locator('#onboarding-skip').click();
  await expect(page.locator('#duel-find')).toBeVisible();

  await page.reload();
  await page.locator('#nav-to-duel').click();
  await expect(page.locator('#duel-find')).toBeVisible();
});

test('how to play replays the tutorial and a keyboard user can skip it', async ({ page }) => {
  await mockDuelStart(page);
  await page.goto('/');
  await registerNickname(page);
  await page.locator('#nav-to-duel').click();
  await page.locator('#onboarding-skip').click();
  await expect(page.locator('#duel-find')).toBeVisible();

  await page.goto('/');
  await page.locator('#nav-to-onboarding').click();
  await expect(page.locator('#screen-onboarding')).toBeVisible();
  await page.locator('#onboarding-skip').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#duel-find')).toBeVisible();
});

test('replay restarts the tutorial from the first caption', async ({ page }) => {
  await mockDuelStart(page);
  await page.goto('/');
  await page.locator('#nav-to-onboarding').click();
  await page.locator('[role=textbox]').focus();
  await page.keyboard.type('find your rhythm each ', { delay: 15 });
  await expect(page.getByText('Every word hits your rival')).toBeVisible();
  await page.locator('#onboarding-replay').click();
  await expect(page.getByText('Type the glowing text')).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'Training dummy HP' })).toHaveAttribute(
    'aria-valuenow',
    '100',
  );
});

test('the tutorial fits a phone-width screen without horizontal scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await mockDuelStart(page);
  await page.goto('/');
  await registerNickname(page);
  await page.locator('#nav-to-duel').click();
  await expect(page.locator('#screen-onboarding')).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
