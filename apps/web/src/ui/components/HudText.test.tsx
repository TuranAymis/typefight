import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { HudText } from './HudText';

it('renders a polite live value with the E2E value selector', () => {
  const html = renderToStaticMarkup(
    <HudText label="Position:" value="3 / 43" valueId="stat-position" live="polite" />,
  );
  expect(html).toContain('aria-live="polite"');
  expect(html).toContain('aria-atomic="true"');
  expect(html).toContain('id="stat-position"');
  expect(html).toContain('3 / 43');
});
