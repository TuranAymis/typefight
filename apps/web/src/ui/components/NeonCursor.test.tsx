import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { NeonCursor } from './NeonCursor';

it('renders an error underline cursor and its current character', () => {
  const html = renderToStaticMarkup(
    <NeonCursor id="cursor-char" shape="underline" error>
      e
    </NeonCursor>,
  );
  expect(html).toContain('id="cursor-char"');
  expect(html).toContain('e</span>');
});
