import { describe, expect, it } from 'vitest';
import { applyDamage, computeDamage, DUEL_CONFIG, replayDuelWords, simulateDuel } from '../duel';
import type { SessionRecord } from '../session/types';

const record = (
  text: string,
  keys: readonly string[],
  times?: readonly number[],
): SessionRecord => ({
  version: 1,
  targetText: text,
  locale: 'en',
  durationMs: 60000,
  events: keys.map((key, index) => ({ key, t: times?.[index] ?? (index + 1) * 100 })),
});

describe('duel damage', () => {
  it('clamps HP and rejects invalid damage', () => {
    expect(applyDamage(100, 5)).toBe(95);
    expect(applyDamage(2, 5)).toBe(0);
    expect(() => applyDamage(10, -1)).toThrow(RangeError);
    expect(() => applyDamage(Number.NaN, 1)).toThrow(RangeError);
  });

  it('covers zero length, accuracy limits, and combo cap', () => {
    expect(computeDamage({ wordLength: 0, accuracy: 1, combo: 1 })).toBe(0);
    expect(computeDamage({ wordLength: 5, accuracy: 0, combo: 0 })).toBe(0);
    expect(computeDamage({ wordLength: 5, accuracy: 1, combo: 0 })).toBe(5);
    expect(computeDamage({ wordLength: 5, accuracy: 0.5, combo: 0 })).toBe(1);
    expect(computeDamage({ wordLength: 5, accuracy: 1, combo: 20 })).toBe(10);
    expect(computeDamage({ wordLength: 5, accuracy: 1, combo: 30 })).toBe(10);
    for (const input of [
      { wordLength: -1, accuracy: 1, combo: 0 },
      { wordLength: 1, accuracy: Number.NaN, combo: 0 },
      { wordLength: 1, accuracy: 2, combo: 0 },
      { wordLength: 1, accuracy: 1, combo: -1 },
    ])
      expect(() => computeDamage(input)).toThrow(RangeError);
  });
});

describe('duel replay', () => {
  it('derives completed words, per-word accuracy, and combo from key times', () => {
    const result = replayDuelWords(
      record('cat dog', ['c', 'a', 't', ' ', 'd', 'x', 'o', 'g']),
      'A',
    );
    expect(result).toMatchObject([
      { atMs: 300, word: 'cat', accuracy: 1, combo: 1, damage: 3 },
      { atMs: 800, word: 'dog', accuracy: 0.75, combo: 0, damage: 2 },
    ]);
    expect(replayDuelWords(record('abc', ['a', 'b']), 'A')).toEqual([]);
  });

  it('ends at KO and gives the winner the remaining HP advantage', () => {
    const config = { ...DUEL_CONFIG, maxHp: 3 };
    const result = simulateDuel(
      record('cat', ['c', 'a', 't']),
      record('dog', ['d', 'o', 'g'], [400, 500, 600]),
      config,
    );
    expect(result).toMatchObject({ winner: 'A', hpA: 3, hpB: 0, endedAt: 300 });
    expect(result.timeline).toHaveLength(1);
  });

  it('uses remaining HP at the time limit and draws when equal', () => {
    const a = record('cat', ['c', 'a', 't']);
    const b = record('dog', ['d', 'o', 'g'], [400, 500, 600]);
    expect(simulateDuel(a, b, { ...DUEL_CONFIG, timeLimitMs: 500 }).winner).toBe('A');
    expect(simulateDuel(a, b).winner).toBe('draw');
    expect(simulateDuel(record('a', []), record('b', [])).winner).toBe('draw');
    expect(simulateDuel(record('a', []), b).winner).toBe('B');
    expect(() => simulateDuel(a, b, { ...DUEL_CONFIG, maxHp: 0 })).toThrow(RangeError);
  });

  it('integrates timed ghost glitch fires and repeats identically', () => {
    const a = record('cat', ['c', 'a', 't']);
    const b = record('dog', ['d', 'o', 'g'], [400, 500, 600]);
    const config = {
      ...DUEL_CONFIG,
      glitchFiresB: [{ type: 'STATIC' as const, atMs: 250, patternIndex: 2 }],
    };
    const expected = simulateDuel(a, b, config);
    expect(expected.timeline[0]).toMatchObject({
      atMs: 250,
      actor: 'B',
      kind: 'glitch',
      damage: 5,
      hpA: 95,
    });
    for (let iteration = 0; iteration < 100; iteration += 1) {
      expect(simulateDuel(a, b, config)).toEqual(expected);
    }
    const fromA = simulateDuel(a, b, {
      ...DUEL_CONFIG,
      glitchFiresA: [{ type: 'SCRAMBLE', atMs: 250, patternIndex: 1 }],
    });
    expect(fromA.timeline[0]).toMatchObject({ atMs: 250, actor: 'A', kind: 'glitch', hpB: 95 });
  });
});
