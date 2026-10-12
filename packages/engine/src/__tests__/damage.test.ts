import { describe, expect, it } from 'vitest';
import { computeDamage } from '../duel/damage';

describe('computeDamage', () => {
  it('uses word length as base damage at combo zero', () => {
    expect(computeDamage({ wordLength: 5, combo: 0, staggered: false })).toBe(5);
  });

  it('adds capped combo bonus and floors integer results', () => {
    expect(computeDamage({ wordLength: 5, combo: 10, staggered: false })).toBe(10);
    expect(computeDamage({ wordLength: 5, combo: 99, staggered: false })).toBe(10);
    expect(computeDamage({ wordLength: 7, combo: 1, staggered: false })).toBe(7);
    expect(computeDamage({ wordLength: 7.9, combo: 2.9, staggered: false })).toBe(8);
  });

  it('clamps negative combo and returns zero for staggered or invalid lengths', () => {
    expect(computeDamage({ wordLength: 5, combo: -3, staggered: false })).toBe(5);
    expect(computeDamage({ wordLength: 5, combo: 3, staggered: true })).toBe(0);
    expect(computeDamage({ wordLength: 0, combo: 3, staggered: false })).toBe(0);
    expect(computeDamage({ wordLength: Number.NaN, combo: 3, staggered: false })).toBe(0);
  });
});
