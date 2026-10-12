import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Button } from './Button';

describe('Button', () => {
  it('renders a disabled danger button with a stable selector', () => {
    const html = renderToStaticMarkup(
      <Button id="stop" variant="danger" size="small" disabled>
        Stop
      </Button>,
    );
    expect(html).toContain('id="stop"');
    expect(html).toContain('disabled=""');
    expect(html).toContain('Stop</button>');
  });

  it('defaults to a non-submitting primary button', () => {
    const html = renderToStaticMarkup(<Button>Launch</Button>);
    expect(html).toContain('type="button"');
    expect(html).toContain('Launch</button>');
  });
});
