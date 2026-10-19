import { expect, test } from '@playwright/test';

// The dev server and the portal build are both started with VITE_FEEDBACK_URL (playwright.config.ts).
test('the menu has a one-click feedback link that opens the form in a new tab', async ({
  page,
}, info) => {
  await page.goto('/');
  const link = page.getByRole('link', { name: 'Send feedback' });
  if (info.project.name === 'portal') {
    // Portals do not allow outside links.
    await expect(page.locator('#screen-menu')).toBeVisible();
    await expect(link).toHaveCount(0);
    return;
  }
  await expect(link).toHaveAttribute('href', 'https://feedback.typefight.test/form');
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
});

test('the link stays available on every screen and sends nothing from the game', async ({
  page,
}, info) => {
  test.skip(info.project.name === 'portal', 'The portal build hides the link');
  const outgoing: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('feedback.typefight.test')) outgoing.push(request.url());
  });
  await page.goto('/');
  for (const id of ['nav-to-simulator']) {
    await page.locator(`#${id}`).click();
    await expect(page.getByRole('link', { name: 'Send feedback' })).toBeVisible();
  }
  expect(outgoing).toEqual([]);
});
