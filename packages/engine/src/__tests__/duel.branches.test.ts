import { describe, expect, it } from 'vitest';
import { computeComboTimeline } from '../duel/combo';
import { simulateDuel } from '../duel/simulate';
import type { SessionRecord } from '../session/types';

const record = (
  targetText: string,
  keys: readonly string[],
  msPerKey = 100,
  durationMs = 60000,
): SessionRecord => ({
  version: 1,
  targetText,
  locale: 'en',
  events: keys.map((key, index) => ({ t: (index + 1) * msPerKey, key })),
  durationMs,
});

const idle = record('abc', []);

describe('simulateDuel, player b side', () => {
  it('lets b win by KO', () => {
    const result = simulateDuel(idle, record('abc', [...'abc']), { maxHp: 3, durationMs: 60000 });
    expect(result).toMatchObject({ winner: 'b', reason: 'ko', hp: { a: 0, b: 3 } });
  });

  it('lets b win on HP at time up', () => {
    const result = simulateDuel(idle, record('abc', [...'abc']), { maxHp: 100, durationMs: 1000 });
    expect(result).toMatchObject({ winner: 'b', reason: 'hp' });
  });

  it('lets b win on WPM with equal HP', () => {
    const result = simulateDuel(record('aaaaa', [...'aa']), record('aaaaa', [...'aaaa']), {
      maxHp: 100,
      durationMs: 1000,
    });
    expect(result).toMatchObject({ winner: 'b', reason: 'wpm' });
  });

  it('lets b win on accuracy with equal HP and WPM', () => {
    const result = simulateDuel(
      record('aaaaa', ['a', 'x', 'Backspace', 'a']),
      record('aaaaa', ['a', 'a']),
      { maxHp: 100, durationMs: 1000 },
    );
    expect(result).toMatchObject({ winner: 'b', reason: 'accuracy' });
  });

  it('keeps the default config when none is given', () => {
    expect(simulateDuel(idle, idle)).toMatchObject({ winner: 'draw', endedAt: 60000 });
  });

  it('ignores a record whose own duration ended before its keystrokes', () => {
    const early = record('abc', [...'abc'], 100, 150);
    expect(simulateDuel(early, idle).damageEvents).toEqual([]);
  });
});

describe('stagger in a duel', () => {
  it('deals no damage for a word finished while staggered', () => {
    // Wrong 'x' at 100ms staggers until 600ms, so the word 'ab' finished at 300ms deals nothing.
    const staggered = record('ab', ['x', 'a', 'b'], 100);
    const result = simulateDuel(staggered, idle, { maxHp: 10, durationMs: 60000 });
    expect(result.damageEvents).toEqual([]);
    expect(result.hp).toEqual({ a: 10, b: 10 });
  });

  it('deals damage again once the stagger is over', () => {
    const recovered = record('ab', ['x', 'Backspace', 'a', 'b'], 300);
    const result = simulateDuel(recovered, idle, { maxHp: 10, durationMs: 60000 });
    expect(result.damageEvents).toEqual([{ t: 1200, amount: 2, source: 'player' }]);
  });
});

describe('computeComboTimeline edge cases', () => {
  it('ignores keys beyond the target, multi-char keys and extra Backspace', () => {
    const timeline = computeComboTimeline(
      record('ab', ['Backspace', 'Shift', 'a', 'b', 'c', 'd'], 100),
    );
    expect(timeline.events).toHaveLength(1);
    expect(timeline.maxCombo).toBe(1);
  });

  it('skips keys that normalize to more than one character', () => {
    const timeline = computeComboTimeline({
      ...record('ab', ['İ', 'a', 'b']),
      locale: 'en',
    });
    expect(timeline.finalCombo).toBe(1);
  });

  it('returns an empty timeline for an empty target', () => {
    expect(computeComboTimeline(record('', ['a']))).toEqual({
      events: [],
      finalCombo: 0,
      maxCombo: 0,
    });
  });
});
