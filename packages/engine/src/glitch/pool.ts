import { GLITCH_STRINGS } from '@typefight/texts';
export type GlitchEffect = 'scramble' | 'blackout' | 'static' | 'overclock';

export interface GlitchString {
  readonly effect: GlitchEffect;
  /** Typed by the attacker like a normal word; lowercase a-z only. */
  readonly string: string;
}

/**
 * Glitch string pool. Changing order or contents changes placement for every existing seed, so
 * treat it as versioned data: append only.
 */
export const GLITCH_POOL = GLITCH_STRINGS as readonly GlitchString[];
