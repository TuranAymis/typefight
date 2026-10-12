import { computeResult } from '../session/scoring';
import type { DamageEvent, SessionRecord } from '../session/types';
import { computeComboTimeline } from './combo';
import { computeDamage } from './damage';

export interface DuelConfig {
  readonly maxHp: number;
  /** The duel ends here; keystrokes after this moment are ignored. */
  readonly durationMs: number;
}

export const DEFAULT_DUEL_CONFIG: DuelConfig = { maxHp: 100, durationMs: 60000 };

export type DuelWinner = 'a' | 'b' | 'draw';
export type DuelOutcomeReason = 'ko' | 'hp' | 'wpm' | 'accuracy' | 'draw';

export interface DuelResult {
  readonly winner: DuelWinner;
  readonly reason: DuelOutcomeReason;
  readonly hp: { readonly a: number; readonly b: number };
  /** Moment the duel was decided: the KO time, otherwise the duel duration. */
  readonly endedAt: number;
  /** Damage in time order. `player` is record a hitting b, `opponent` is b hitting a. */
  readonly damageEvents: readonly DamageEvent[];
}

const damageOf = (record: SessionRecord, source: DamageEvent['source'], limit: number) => {
  const staggerSpans: { from: number; to: number }[] = [];
  const events: DamageEvent[] = [];
  const cutoff = Math.min(limit, record.durationMs);
  for (const event of computeComboTimeline(record).events) {
    if (event.t > cutoff) continue;
    if (event.type === 'stagger') {
      staggerSpans.push({ from: event.t, to: event.endsAt });
    } else if (event.type === 'word') {
      const staggered = staggerSpans.some((w) => event.t > w.from && event.t < w.to);
      const amount = computeDamage({ wordLength: event.length, combo: event.combo, staggered });
      if (amount > 0) events.push({ t: event.t, amount, source });
    }
  }
  return events;
};

/** The part of a record that counts in a duel: nothing typed after `limit` exists. */
const truncate = (record: SessionRecord, limit: number): SessionRecord => ({
  ...record,
  events: record.events.filter((event) => event.t <= limit),
  durationMs: Math.min(record.durationMs, limit),
});

const resolveTimeUp = (
  a: SessionRecord,
  b: SessionRecord,
  hp: { a: number; b: number },
  limit: number,
): Pick<DuelResult, 'winner' | 'reason'> => {
  if (hp.a !== hp.b) return { winner: hp.a > hp.b ? 'a' : 'b', reason: 'hp' };
  const resultA = computeResult(truncate(a, limit));
  const resultB = computeResult(truncate(b, limit));
  if (resultA.wpm !== resultB.wpm) {
    return { winner: resultA.wpm > resultB.wpm ? 'a' : 'b', reason: 'wpm' };
  }
  if (resultA.accuracy !== resultB.accuracy) {
    return { winner: resultA.accuracy > resultB.accuracy ? 'a' : 'b', reason: 'accuracy' };
  }
  return { winner: 'draw', reason: 'draw' };
};

/**
 * Official duel outcome from two session records. Pure and deterministic, so server and client
 * always agree. Events at the same millisecond land simultaneously (both players can KO each
 * other). When time runs out the winner is, in order: higher HP, higher WPM, higher accuracy,
 * otherwise a draw.
 */
export const simulateDuel = (
  a: SessionRecord,
  b: SessionRecord,
  config: DuelConfig = DEFAULT_DUEL_CONFIG,
): DuelResult => {
  const merged = [
    ...damageOf(a, 'player', config.durationMs),
    ...damageOf(b, 'opponent', config.durationMs),
  ].sort((x, y) => x.t - y.t);

  const hp = { a: config.maxHp, b: config.maxHp };
  const applied: DamageEvent[] = [];
  let index = 0;
  while (index < merged.length) {
    const now = merged[index]?.t ?? 0;
    while (index < merged.length && merged[index]?.t === now) {
      const event = merged[index] as DamageEvent;
      if (event.source === 'player') hp.b = Math.max(0, hp.b - event.amount);
      else hp.a = Math.max(0, hp.a - event.amount);
      applied.push(event);
      index += 1;
    }
    if (hp.a === 0 || hp.b === 0) {
      const winner: DuelWinner = hp.a === hp.b ? 'draw' : hp.a > hp.b ? 'a' : 'b';
      return {
        winner,
        reason: winner === 'draw' ? 'draw' : 'ko',
        hp,
        endedAt: now,
        damageEvents: applied,
      };
    }
  }

  return {
    ...resolveTimeUp(a, b, hp, config.durationMs),
    hp,
    endedAt: config.durationMs,
    damageEvents: applied,
  };
};
