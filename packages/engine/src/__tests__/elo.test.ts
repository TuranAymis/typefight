import { describe, expect, it } from 'vitest';
import { INITIAL_RATING, MIN_RATING, expectedScore, updateRatings } from '../rating/elo';

describe('elo', () => {
  it('starts at 1000 and gives equal players an even expectation', () => {
    expect(INITIAL_RATING).toBe(1000);
    expect(expectedScore(1000, 1000)).toBe(0.5);
  });

  it('moves equal players by half of K on a win', () => {
    expect(updateRatings(1000, 1000, 'a')).toEqual({ a: 1016, b: 984, delta: 16 });
    expect(updateRatings(1000, 1000, 'b')).toEqual({ a: 984, b: 1016, delta: -16 });
  });

  it('leaves equal players unchanged on a draw and moves the lower one up on a draw', () => {
    expect(updateRatings(1000, 1000, 'draw')).toEqual({ a: 1000, b: 1000, delta: 0 });
    const result = updateRatings(900, 1100, 'draw');
    expect(result.a).toBeGreaterThan(900);
    expect(result.b).toBeLessThan(1100);
  });

  it('rewards upsets more than expected wins', () => {
    const upset = updateRatings(900, 1200, 'a').delta;
    const expected = updateRatings(1200, 900, 'a').delta;
    expect(upset).toBeGreaterThan(expected);
    expect(expected).toBeGreaterThanOrEqual(0);
  });

  it('is zero-sum away from the floor and never goes below the floor', () => {
    for (const [a, b] of [
      [1000, 1000],
      [1337, 842],
      [500, 1900],
    ] as const) {
      const r = updateRatings(a, b, 'a');
      expect(r.a + r.b).toBe(a + b);
    }
    expect(updateRatings(MIN_RATING, 1000, 'b').a).toBe(MIN_RATING);
  });
});
