import { describe, expect, it } from 'vitest';
import { simulateDuel } from '../duel/simulate';
import type { SessionRecord } from '../session/types';

const record = (
  targetText: string,
  keys: readonly string[],
  durationMs = 60000,
  msPerKey = 100,
): SessionRecord => ({
  version: 1,
  targetText,
  locale: 'en',
  events: keys.map((key, index) => ({ t: (index + 1) * msPerKey, key })),
  durationMs,
});

const emptyRecord = (targetText = 'abc'): SessionRecord => record(targetText, []);

const deepFreeze = (value: object): void => {
  for (const child of Object.values(value)) {
    if (child !== null && typeof child === 'object') deepFreeze(child);
  }
  Object.freeze(value);
};

describe('simulateDuel', () => {
  it('ends with a KO winner', () => {
    const result = simulateDuel(record('abc def', [...'abc def']), emptyRecord(), {
      maxHp: 6,
      durationMs: 60000,
    });

    expect(result).toMatchObject({
      winner: 'a',
      reason: 'ko',
      hp: { a: 6, b: 0 },
      endedAt: 700,
    });
  });

  it('resolves simultaneous KO as a draw', () => {
    const result = simulateDuel(record('abc', [...'abc']), record('xyz', [...'xyz']), {
      maxHp: 3,
      durationMs: 60000,
    });

    expect(result).toMatchObject({
      winner: 'draw',
      reason: 'draw',
      hp: { a: 0, b: 0 },
      endedAt: 300,
    });
  });

  it('uses HP as the first time-up tie-break', () => {
    const result = simulateDuel(record('abc', [...'abc']), emptyRecord(), {
      maxHp: 100,
      durationMs: 1000,
    });

    expect(result).toMatchObject({
      winner: 'a',
      reason: 'hp',
      hp: { a: 100, b: 97 },
      endedAt: 1000,
    });
  });

  it('uses WPM when time expires with equal HP', () => {
    const result = simulateDuel(record('aaaaa', [...'aaaa']), record('aaaaa', [...'aa']), {
      maxHp: 100,
      durationMs: 1000,
    });

    expect(result).toMatchObject({ winner: 'a', reason: 'wpm', hp: { a: 100, b: 100 } });
  });

  it('uses accuracy when HP and WPM are tied', () => {
    const result = simulateDuel(
      record('aaaaa', ['a', 'a']),
      record('aaaaa', ['a', 'x', 'Backspace', 'a']),
      { maxHp: 100, durationMs: 1000 },
    );

    expect(result).toMatchObject({ winner: 'a', reason: 'accuracy' });
  });

  it('draws when every time-up tie-break is equal', () => {
    const result = simulateDuel(record('aaaaa', ['a', 'a']), record('aaaaa', ['a', 'a']), {
      maxHp: 100,
      durationMs: 1000,
    });

    expect(result).toMatchObject({ winner: 'draw', reason: 'draw' });
  });

  it('ignores damage events after the configured duration', () => {
    const result = simulateDuel(record('abc', [...'abc']), emptyRecord(), {
      maxHp: 3,
      durationMs: 250,
    });

    // The word finishes at 300ms, after the cutoff: no damage. Tie-break only sees the 2 letters
    // typed before 250ms, so A still wins on WPM.
    expect(result).toMatchObject({
      winner: 'a',
      reason: 'wpm',
      hp: { a: 3, b: 3 },
      endedAt: 250,
      damageEvents: [],
    });
  });

  it('honors custom DuelConfig values', () => {
    const result = simulateDuel(record('abc', [...'abc']), emptyRecord(), {
      maxHp: 4,
      durationMs: 400,
    });

    expect(result).toMatchObject({
      winner: 'a',
      reason: 'hp',
      hp: { a: 4, b: 1 },
      endedAt: 400,
    });
  });

  it('is deterministic with deep-frozen inputs', () => {
    const a = record('alpha beta gamma', [...'alpha beta gamma']);
    const b = record('alpha beta gamma', ['a', 'x', 'Backspace', ...'alpha beta gamma'.slice(1)]);
    const baseline = JSON.stringify(simulateDuel(a, b, { maxHp: 30, durationMs: 60000 }));

    deepFreeze(a);
    deepFreeze(b);

    for (let iteration = 0; iteration < 100; iteration += 1) {
      expect(JSON.stringify(simulateDuel(a, b, { maxHp: 30, durationMs: 60000 }))).toBe(baseline);
    }
  });
});
