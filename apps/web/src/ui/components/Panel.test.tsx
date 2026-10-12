import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Panel } from './Panel';

it('renders a titled section and its content', () => {
  const html = renderToStaticMarkup(
    <Panel title="Simulator" aria-label="Training panel">
      <p>Practice</p>
    </Panel>,
  );
  expect(html).toContain('<section');
  expect(html).toContain('<h2');
  expect(html).toContain('Simulator</h2>');
  expect(html).toContain('<p>Practice</p>');
});
