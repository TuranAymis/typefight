import { describe, expect, it } from 'vitest';
import { applyGlitches, placeGlitches } from '../glitch/placement';
import { GLITCH_POOL } from '../glitch/pool';
import { createRng } from '../glitch/rng';

const sampleText =
  'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigma';

describe('glitch placement', () => {
  it('creates deterministic RNG sequences from textId and seed', () => {
    const first = createRng('text-a', 7);
    const second = createRng('text-a', 7);
    const otherSeed = createRng('text-a', 8);
    const otherText = createRng('text-b', 7);

    const sequence = (rng: ReturnType<typeof createRng>): readonly number[] => [
      rng.next(),
      rng.next(),
      rng.int(10),
      rng.int(10),
    ];

    expect(sequence(first)).toEqual(sequence(second));
    expect(sequence(createRng('text-a', 7))).not.toEqual(sequence(otherSeed));
    expect(sequence(createRng('text-a', 7))).not.toEqual(sequence(otherText));
  });

  it('keeps int(bound) in range and returns zero for non-positive bounds', () => {
    const rng = createRng('range', 'seed');

    for (let iteration = 0; iteration < 100; iteration += 1) {
      const value = rng.int(4);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(4);
    }
    expect(rng.int(0)).toBe(0);
    expect(rng.int(-1)).toBe(0);
  });

  it('places glitches deterministically and respects limits', () => {
    const input = { textId: 'sample', seed: 42, targetText: sampleText, maxGlitches: 3 };
    const baseline = JSON.stringify(placeGlitches(input));

    for (let iteration = 0; iteration < 100; iteration += 1) {
      expect(JSON.stringify(placeGlitches(input))).toBe(baseline);
    }

    const placements = placeGlitches(input);
    expect(placements).toHaveLength(2);
    expect(placements.length).toBeLessThanOrEqual(input.maxGlitches);
    for (let index = 0; index < placements.length; index += 1) {
      const placement = placements[index];
      expect(placement?.beforeWordIndex).toBeGreaterThanOrEqual(1);
      if (index > 0) {
        expect(placement?.beforeWordIndex).toBeGreaterThan(
          placements[index - 1]?.beforeWordIndex ?? 0,
        );
      }
    }
  });

  it('respects custom minSegmentWords and returns empty for empty or short text', () => {
    expect(placeGlitches({ textId: 'empty', seed: 1, targetText: '' })).toEqual([]);
    expect(placeGlitches({ textId: 'short', seed: 1, targetText: 'one two three' })).toEqual([]);
    expect(
      placeGlitches({
        textId: 'dense',
        seed: 1,
        targetText: sampleText,
        maxGlitches: 10,
        minSegmentWords: 3,
      }),
    ).toHaveLength(5);
  });

  it('keeps every pool string lowercase a-z and every effect represented in the pool', () => {
    const poolEffects = new Set(GLITCH_POOL.map((entry) => entry.effect));

    for (const entry of GLITCH_POOL) {
      expect(entry.string).toMatch(/^[a-z]+$/);
      expect(poolEffects.has(entry.effect)).toBe(true);
    }

    for (const placement of placeGlitches({ textId: 'pool', seed: 9, targetText: sampleText })) {
      expect(placement.string).toMatch(/^[a-z]+$/);
      expect(GLITCH_POOL).toContainEqual({ effect: placement.effect, string: placement.string });
    }
  });

  it('applies glitches at the right words and reports exact marker positions', () => {
    const applied = applyGlitches('alpha beta gamma delta', [
      { id: 0, beforeWordIndex: 1, effect: 'static', string: 'noise' },
      { id: 1, beforeWordIndex: 3, effect: 'blackout', string: 'void' },
    ]);

    expect(applied.text).toBe('alpha noise beta gamma void delta');
    expect(applied.text).toMatch(/^[a-z ]+$/);
    expect(applied.markers).toEqual([
      { id: 0, wordIndex: 1, charIndex: 6, effect: 'static', string: 'noise' },
      { id: 1, wordIndex: 4, charIndex: 23, effect: 'blackout', string: 'void' },
    ]);

    for (const marker of applied.markers) {
      expect(applied.text.slice(marker.charIndex, marker.charIndex + marker.string.length)).toBe(
        marker.string,
      );
      expect(applied.text.split(' ')[marker.wordIndex]).toBe(marker.string);
    }
  });
});
