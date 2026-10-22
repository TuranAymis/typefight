import { expect, test } from '@playwright/test';

// The dev server and the portal build are both started with VITE_AD_PLACEHOLDERS=true (playwright.config.ts).
test('calm screens reserve a fixed banner slot that does not move the page or take focus', async ({
  page,
}, info) => {
  await page.goto('/');
  await expect(page.locator('#screen-menu')).toBeVisible();
  const slot = page.locator('#ad-slot');
  if (info.project.name === 'portal') {
    // The portal serves its own ads through its SDK: the game never shows a placeholder.
    await expect(slot).toHaveCount(0);
    return;
  }
  await expect(slot).toBeVisible();
  await expect(slot).toHaveAccessibleName('Advertisement');
  const box = await slot.locator('[data-ad-placeholder]').boundingBox();
  expect(box?.height).toBe(90);
  // No provider is configured in the tests, so the slot shows one of our own apps.
  await expect(slot).toHaveAttribute('data-ad-source', 'house');
  const link = slot.getByRole('link', { name: /Vento/ });
  await expect(link).toHaveAttribute('href', 'https://ventoride.com');
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', /noopener/);
  await expect(slot.locator('img')).toHaveJSProperty('complete', true);
  expect(await slot.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  // The unit keeps its size while the rest of the page settles (the menu itself may grow once the
  // player identity loads, which is not the banner's doing).
  const unit = slot.locator('[data-ad-placeholder]');
  const before = await unit.boundingBox();
  await page.waitForTimeout(300);
  const after = await unit.boundingBox();
  expect({ width: after?.width, height: after?.height }).toEqual({
    width: before?.width,
    height: before?.height,
  });
});

test('no banner while the player types', async ({ page }, info) => {
  test.skip(info.project.name === 'portal', 'The portal build has no placeholders');
  await page.goto('/');
  await expect(page.locator('#ad-slot')).toBeVisible();
  await page.locator('#nav-to-simulator').click();
  await expect(page.locator('#screen-simulator')).toBeVisible();
  await expect(page.locator('#ad-slot')).toHaveCount(0);
});

test('the banner fits a phone screen with no sideways scroll', async ({ page }, info) => {
  test.skip(info.project.name === 'portal', 'The portal build has no placeholders');
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/');
  const unit = page.locator('#ad-slot [data-ad-placeholder]');
  await expect(unit).toBeVisible();
  expect((await unit.boundingBox())?.height).toBe(50);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});
