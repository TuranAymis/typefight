export type GlitchType = 'SCRAMBLE' | 'BLACKOUT' | 'STATIC' | 'OVERCLOCK';

export interface GlitchPlacement {
  readonly index: number;
  readonly type: GlitchType;
  readonly pattern: string;
}

export interface GlitchFire {
  readonly type: GlitchType;
  readonly atMs: number;
  readonly patternIndex: number;
}

export type LastFires = Partial<Record<GlitchType, number>>;

/** Balance values and typed pattern content for glitch attacks. */
export const GLITCH_CONFIG = {
  /** Minimum elapsed time between successful fires of each type, in milliseconds. */
  cooldownMs: { SCRAMBLE: 8000, BLACKOUT: 10000, STATIC: 6000, OVERCLOCK: 12000 },
  /** HP penalty for typing the wrong attack pattern. */
  failedPenalty: 2,
  /** HP damage to the opponent from a recorded fire. */
  fireDamage: 5,
  /** Allowed lowercase typing patterns for each attack type. */
  patterns: {
    SCRAMBLE: ['mix', 'warp', 'shift'],
    BLACKOUT: ['dark', 'blind', 'void'],
    STATIC: ['buzz', 'hiss', 'noise'],
    OVERCLOCK: ['rush', 'surge', 'speed'],
  },
} as const;

const GLITCH_TYPES: readonly GlitchType[] = ['SCRAMBLE', 'BLACKOUT', 'STATIC', 'OVERCLOCK'];

/** Creates a repeatable stream of values in [0, 1) from a string or number seed. */
export const createGlitchRng = (seed: string | number): (() => number) => {
  let state = 2166136261;
  for (const character of String(seed)) {
    state = Math.imul(state ^ character.charCodeAt(0), 16777619);
  }
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

/** Places distinct glitches on character indices in a repeatable order. */
export const placeGlitches = (
  textId: string,
  seed: string | number,
  textLength: number,
  count: number,
): GlitchPlacement[] => {
  if (
    !Number.isSafeInteger(textLength) ||
    textLength < 0 ||
    !Number.isSafeInteger(count) ||
    count < 0 ||
    count > textLength
  ) {
    throw new RangeError('Invalid glitch placement bounds');
  }
  const rng = createGlitchRng(`${textId}:${seed}`);
  const available = Array.from({ length: textLength }, (_, index) => index);
  const placements: GlitchPlacement[] = [];
  for (let position = 0; position < count; position += 1) {
    const choice = Math.floor(rng() * available.length);
    const index = available.splice(choice, 1)[0]!;
    const type = GLITCH_TYPES[Math.floor(rng() * GLITCH_TYPES.length)]!;
    const patterns = GLITCH_CONFIG.patterns[type];
    placements.push({ index, type, pattern: patterns[Math.floor(rng() * patterns.length)]! });
  }
  return placements.sort((left, right) => left.index - right.index);
};

/** Checks a type's cooldown at the supplied time. */
export const canFireGlitch = (
  lastFireAtByType: LastFires,
  type: GlitchType,
  nowMs: number,
): boolean => {
  if (!Number.isFinite(nowMs)) throw new RangeError('Invalid glitch time');
  const lastFire = lastFireAtByType[type];
  return lastFire === undefined || nowMs - lastFire >= GLITCH_CONFIG.cooldownMs[type];
};

export interface GlitchAttempt {
  readonly typedPattern: string;
  readonly expectedPattern: string;
  readonly type: GlitchType;
  readonly nowMs: number;
  readonly lastFires: LastFires;
}

export interface GlitchAttemptResult {
  readonly outcome: 'fired' | 'cooldown' | 'failed';
  readonly penalty: number;
  readonly nextLastFires: LastFires;
}

/** Resolves a typed attack without mutating the cooldown record. */
export const resolveGlitchAttempt = (attempt: GlitchAttempt): GlitchAttemptResult => {
  if (!canFireGlitch(attempt.lastFires, attempt.type, attempt.nowMs)) {
    return { outcome: 'cooldown', penalty: 0, nextLastFires: { ...attempt.lastFires } };
  }
  if (attempt.typedPattern !== attempt.expectedPattern) {
    return {
      outcome: 'failed',
      penalty: GLITCH_CONFIG.failedPenalty,
      nextLastFires: { ...attempt.lastFires },
    };
  }
  return {
    outcome: 'fired',
    penalty: 0,
    nextLastFires: { ...attempt.lastFires, [attempt.type]: attempt.nowMs },
  };
};

/** Inserts a fire chronologically while leaving the input untouched. */
export const recordGlitchFire = (list: readonly GlitchFire[], fire: GlitchFire): GlitchFire[] =>
  [...list, fire].sort((left, right) => left.atMs - right.atMs);

/** Replays fires in the half-open [fromMs, toMs) interval. */
export const replayGlitchFires = (
  fires: readonly GlitchFire[],
  fromMs: number,
  toMs: number,
): GlitchFire[] =>
  fires
    .filter((fire) => fire.atMs >= fromMs && fire.atMs < toMs)
    .sort((left, right) => left.atMs - right.atMs);
