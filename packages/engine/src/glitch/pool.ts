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
export const GLITCH_POOL: readonly GlitchString[] = [
  { effect: 'scramble', string: 'jumble' },
  { effect: 'scramble', string: 'shuffle' },
  { effect: 'scramble', string: 'tangle' },
  { effect: 'scramble', string: 'warp' },
  { effect: 'blackout', string: 'void' },
  { effect: 'blackout', string: 'eclipse' },
  { effect: 'blackout', string: 'dusk' },
  { effect: 'blackout', string: 'shadow' },
  { effect: 'static', string: 'noise' },
  { effect: 'static', string: 'fuzz' },
  { effect: 'static', string: 'snow' },
  { effect: 'static', string: 'hiss' },
  { effect: 'overclock', string: 'surge' },
  { effect: 'overclock', string: 'turbo' },
  { effect: 'overclock', string: 'rush' },
  { effect: 'overclock', string: 'spike' },
];
