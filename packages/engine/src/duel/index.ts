import type { SessionRecord } from '../session/types';
import { GLITCH_CONFIG, type GlitchFire, type GlitchType } from '../glitch';

/** Balance values and match limits for a duel. */
export const DUEL_CONFIG = {
  /** Starting and maximum HP for both players. */
  maxHp: 100,
  /** Duel deadline measured from timestamp zero. */
  timeLimitMs: 60000,
  /** Damage awarded per completed character before modifiers. */
  baseDamagePerChar: 1,
  /** Power applied to first-attempt accuracy. */
  accuracyExponent: 2,
  /** Multiplier increase for each perfect word in a combo. */
  comboStep: 0.05,
  /** Maximum combo level used by the damage multiplier. */
  comboCap: 20,
} as const;

export interface DuelConfig {
  readonly maxHp: number;
  readonly timeLimitMs: number;
  readonly baseDamagePerChar: number;
  readonly accuracyExponent: number;
  readonly comboStep: number;
  readonly comboCap: number;
  readonly glitchFiresA?: readonly GlitchFire[];
  readonly glitchFiresB?: readonly GlitchFire[];
}

export interface DamageInput {
  readonly wordLength: number;
  readonly accuracy: number;
  readonly combo: number;
}

export interface DuelTimelineEvent {
  readonly atMs: number;
  readonly actor: 'A' | 'B';
  readonly kind: 'word' | 'glitch';
  readonly damage: number;
  readonly hpA: number;
  readonly hpB: number;
  readonly word?: string;
  readonly accuracy?: number;
  readonly combo?: number;
  readonly glitchType?: GlitchType;
  readonly patternIndex?: number;
}

export interface DuelResult {
  readonly winner: 'A' | 'B' | 'draw';
  readonly hpA: number;
  readonly hpB: number;
  readonly endedAt: number;
  readonly timeline: readonly DuelTimelineEvent[];
}

interface ReplayEvent {
  readonly atMs: number;
  readonly actor: 'A' | 'B';
  readonly kind: 'word' | 'glitch';
  readonly damage: number;
  readonly word?: string;
  readonly accuracy?: number;
  readonly combo?: number;
  readonly glitchType?: GlitchType;
  readonly patternIndex?: number;
}

/** Applies nonnegative damage and clamps the remaining HP to zero. */
export const applyDamage = (hp: number, damage: number): number => {
  if (!Number.isFinite(hp) || hp < 0 || !Number.isFinite(damage) || damage < 0) {
    throw new RangeError('HP and damage must be finite nonnegative numbers');
  }
  return Math.max(0, hp - damage);
};

/** Computes rounded word damage using the default duel balance. */
export const computeDamage = (input: DamageInput, config: DuelConfig = DUEL_CONFIG): number => {
  if (
    !Number.isSafeInteger(input.wordLength) ||
    input.wordLength < 0 ||
    !Number.isFinite(input.accuracy) ||
    input.accuracy < 0 ||
    input.accuracy > 1 ||
    !Number.isSafeInteger(input.combo) ||
    input.combo < 0
  ) {
    throw new RangeError('Invalid damage input');
  }
  return Math.round(
    input.wordLength *
      config.baseDamagePerChar *
      input.accuracy ** config.accuracyExponent *
      (1 + Math.min(input.combo, config.comboCap) * config.comboStep),
  );
};

/** Replays completed words from timed key presses under blocking input rules. */
export const replayDuelWords = (
  record: SessionRecord,
  actor: 'A' | 'B',
  config: DuelConfig = DUEL_CONFIG,
): ReplayEvent[] => {
  const target = record.targetText;
  const events: ReplayEvent[] = [];
  let cursor = 0;
  let wordStart = 0;
  let attempts = 0;
  let correct = 0;
  let combo = 0;
  for (const event of [...record.events].sort((left, right) => left.t - right.t)) {
    if (
      event.t < 0 ||
      event.t > record.durationMs ||
      event.t >= config.timeLimitMs ||
      event.key.length !== 1
    )
      continue;
    if (cursor >= target.length) break;
    attempts += 1;
    if (event.key !== target[cursor]) {
      combo = 0;
      continue;
    }
    correct += 1;
    cursor += 1;
    if (target[cursor - 1] === ' ') {
      wordStart = cursor;
      attempts = 0;
      correct = 0;
      continue;
    }
    if (cursor === target.length || target[cursor] === ' ') {
      const word = target.slice(wordStart, cursor);
      const accuracy = correct / attempts;
      combo = accuracy === 1 ? combo + 1 : 0;
      events.push({
        atMs: event.t,
        actor,
        kind: 'word',
        damage: computeDamage({ wordLength: word.length, accuracy, combo }, config),
        word,
        accuracy,
        combo,
      });
    }
  }
  return events;
};

/** Merges two session replays and optional recorded ghost attacks. */
export const simulateDuel = (
  recordA: SessionRecord,
  recordB: SessionRecord,
  config: DuelConfig = DUEL_CONFIG,
): DuelResult => {
  if (
    !Number.isFinite(config.maxHp) ||
    config.maxHp <= 0 ||
    !Number.isFinite(config.timeLimitMs) ||
    config.timeLimitMs <= 0
  ) {
    throw new RangeError('Invalid duel limits');
  }
  const events: ReplayEvent[] = [
    ...replayDuelWords(recordA, 'A', config),
    ...replayDuelWords(recordB, 'B', config),
    ...(config.glitchFiresA ?? []).map((fire): ReplayEvent => ({
      atMs: fire.atMs,
      actor: 'A',
      kind: 'glitch',
      damage: GLITCH_CONFIG.fireDamage,
      glitchType: fire.type,
      patternIndex: fire.patternIndex,
    })),
    ...(config.glitchFiresB ?? []).map((fire): ReplayEvent => ({
      atMs: fire.atMs,
      actor: 'B',
      kind: 'glitch',
      damage: GLITCH_CONFIG.fireDamage,
      glitchType: fire.type,
      patternIndex: fire.patternIndex,
    })),
  ].filter((event) => event.atMs >= 0 && event.atMs < config.timeLimitMs);
  events.sort(
    (left, right) =>
      left.atMs - right.atMs ||
      left.actor.localeCompare(right.actor) ||
      left.kind.localeCompare(right.kind),
  );
  let hpA = config.maxHp;
  let hpB = config.maxHp;
  let totalDamageA = 0;
  let totalDamageB = 0;
  let endedAt = config.timeLimitMs;
  const timeline: DuelTimelineEvent[] = [];
  for (const event of events) {
    if (event.actor === 'A') {
      hpB = applyDamage(hpB, event.damage);
      totalDamageA += event.damage;
    } else {
      hpA = applyDamage(hpA, event.damage);
      totalDamageB += event.damage;
    }
    timeline.push({ ...event, hpA, hpB });
    if (hpA === 0 || hpB === 0) {
      endedAt = event.atMs;
      break;
    }
  }
  const winner =
    hpA > hpB
      ? 'A'
      : hpB > hpA
        ? 'B'
        : totalDamageA > totalDamageB
          ? 'A'
          : totalDamageB > totalDamageA
            ? 'B'
            : 'draw';
  return { winner, hpA, hpB, endedAt, timeline };
};
