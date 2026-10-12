# Design tokens

The web UI imports `src/ui/tokens.css` once through `src/index.css`. The palette follows the specification's text-first, high-contrast cyberpunk direction. The specification does not require specific hex values.

- **Surfaces:** `--color-bg`, `--color-bg-elevated`, `--color-bg-hover`, and overlays provide dark layers.
- **Text:** `--color-text`, `--color-text-secondary`, and `--color-text-muted` keep essential labels readable. `--color-text-inverse` is for bright button fills.
- **Signals:** `--color-primary` is cyan, `--color-secondary` is amber, `--color-danger` is pink, and `--color-success` is green. Soft and glow tokens support borders and restrained emphasis.
- **Scale:** `--font-*`, `--font-size-*`, `--space-*`, `--radius-*`, and `--border-thin` set consistent typography and geometry. Fonts use installed monospace system fallbacks; no font is downloaded.
- **Effects:** `--shadow-*`, `--z-*`, `--motion-*`, and `--ease-standard` control elevation, stacking, and timing. Motion uses the system preference by default, with a session-only selector for reduced and full overrides.

WCAG contrast ratios were computed from relative sRGB luminance using `(Llighter + 0.05) / (Ldarker + 0.05)`. On the three solid backgrounds (`#0a0d14`, `#121824`, `#182234`), primary text reaches 17.63:1, 16.12:1, and 14.46:1; secondary text 9.54:1, 8.73:1, and 7.83:1; muted text 8.63:1, 7.89:1, and 7.08:1. All exceed 4.5:1. The radial app background blends between the listed dark colors, so its text contrast stays within these bounds.
