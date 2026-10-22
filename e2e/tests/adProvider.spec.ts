import { expect, test } from '@playwright/test';

// Runs against a build that has ad provider ids (playwright.config.ts, project "adprovider").
// The provider's script is always stubbed here: nothing reaches the real ad network.
const SCRIPT = '**/pagead2.googlesyndication.com/**';

/** A stand-in for adsbygoogle.js: marks every unit with the given status when it is asked to fill. */
const stubScript = (status: 'filled' | 'unfilled' | null) => `
  window.adsbygoogle = window.adsbygoogle || [];
  window.adsbygoogle.push = function () {
    ${status ? `document.querySelectorAll('ins.adsbygoogle').forEach(function (u) { u.setAttribute('data-ad-status', '${status}'); });` : ''}
    return 1;
  };
`;

test('a blocked provider script falls back to our own ad', async ({ page }) => {
  await page.route(SCRIPT, (route) => route.abort());
  await page.goto('/');
  const slot = page.locator('#ad-slot');
  await expect(slot).toHaveAttribute('data-ad-source', 'house');
  await expect(slot.getByRole('link', { name: /Vento/ })).toHaveAttribute(
    'href',
    'https://ventoride.com',
  );
  expect((await slot.locator('[data-ad-placeholder]').boundingBox())?.height).toBe(90);
});

test('a provider ad that fills the unit stays and our ad is not shown', async ({ page }) => {
  await page.route(SCRIPT, (route) =>
    route.fulfill({ contentType: 'application/javascript', body: stubScript('filled') }),
  );
  await page.goto('/');
  const slot = page.locator('#ad-slot');
  await expect(slot).toHaveAttribute('data-ad-source', 'provider');
  await expect(slot.locator('ins.adsbygoogle')).toHaveAttribute('data-ad-client', 'ca-pub-1234567890123456');
  await expect(slot.locator('ins.adsbygoogle')).toHaveAttribute('data-ad-slot', '1234567890');
  await page.waitForTimeout(500);
  await expect(slot).toHaveAttribute('data-ad-source', 'provider');
  await expect(slot.getByRole('link', { name: /Vento/ })).toHaveCount(0);
});

test('a provider with no ad to show (unfilled) falls back to our own ad', async ({ page }) => {
  await page.route(SCRIPT, (route) =>
    route.fulfill({ contentType: 'application/javascript', body: stubScript('unfilled') }),
  );
  await page.goto('/');
  await expect(page.locator('#ad-slot')).toHaveAttribute('data-ad-source', 'house');
});

test('a provider that never answers gives the slot to our own ad after a few seconds', async ({
  page,
}) => {
  await page.route(SCRIPT, (route) =>
    route.fulfill({ contentType: 'application/javascript', body: stubScript(null) }),
  );
  await page.goto('/');
  await expect(page.locator('#ad-slot')).toHaveAttribute('data-ad-source', 'house', {
    timeout: 8000,
  });
});

test('the slot keeps one height through the fallback', async ({ page }) => {
  await page.route(SCRIPT, (route) => route.abort());
  await page.goto('/');
  const heights = new Set<number | undefined>();
  const slot = page.locator('#ad-slot');
  await expect(slot).toBeVisible();
  for (let i = 0; i < 5; i += 1) {
    heights.add((await slot.boundingBox())?.height);
    await page.waitForTimeout(100);
  }
  expect(heights.size).toBe(1);
});
