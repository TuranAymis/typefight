import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ErrorBoundary, ErrorFallback } from './ErrorBoundary';

describe('ErrorBoundary', () => {
  it('switches to the failed state when a child throws', () => {
    expect(ErrorBoundary.getDerivedStateFromError()).toEqual({ failed: true });
  });

  it('renders its children while nothing has failed', () => {
    expect(renderToStaticMarkup(createElement(ErrorBoundary, null, 'fine'))).toBe('fine');
  });

  it('offers a plain way back and a reload, announced as an alert', () => {
    const html = renderToStaticMarkup(createElement(ErrorFallback, { onMenu: () => undefined }));
    expect(html).toContain('role="alert"');
    expect(html).toContain('Something broke');
    expect(html).toContain('id="error-menu"');
    expect(html).toContain('Back to menu');
    expect(html).toContain('id="error-reload"');
  });
});
