import { describe, expect, it } from 'vitest';
import {
  canFireGlitch,
  createGlitchRng,
  GLITCH_CONFIG,
  placeGlitches,
  recordGlitchFire,
  replayGlitchFires,
  resolveGlitchAttempt,
} from '../glitch';

describe('seeded glitch placement', () => {
  it('repeats the same random stream for a seed', () => {
    const first = createGlitchRng('seed');
    const second = createGlitchRng('seed');
    expect(Array.from({ length: 10 }, () => first())).toEqual(
      Array.from({ length: 10 }, () => second()),
    );
    expect(createGlitchRng(123)()).toBeGreaterThanOrEqual(0);
  });

  it('places sorted unique positions and allowed typed patterns', () => {
    const positions = placeGlitches('text', 'one', 100, 10);
    expect(positions).toEqual(placeGlitches('text', 'one', 100, 10));
    expect(positions).not.toEqual(placeGlitches('text', 'two', 100, 10));
    expect(positions.map(({ index }) => index)).toEqual(
      [...positions.map(({ index }) => index)].sort((a, b) => a - b),
    );
    expect(new Set(positions.map(({ index }) => index)).size).toBe(10);
    for (const placement of positions) expect(placement.pattern).toMatch(/^[a-z]+$/);
    expect(placeGlitches('text', 1, 0, 0)).toEqual([]);
    expect(() => placeGlitches('text', 1, 2, 3)).toThrow(RangeError);
  });
});

describe('glitch attacks', () => {
  it('uses per-type cooldowns', () => {
    expect(canFireGlitch({}, 'STATIC', 0)).toBe(true);
    expect(
      canFireGlitch({ STATIC: 100 }, 'STATIC', 100 + GLITCH_CONFIG.cooldownMs.STATIC - 1),
    ).toBe(false);
    expect(canFireGlitch({ STATIC: 100 }, 'STATIC', 100 + GLITCH_CONFIG.cooldownMs.STATIC)).toBe(
      true,
    );
    expect(() => canFireGlitch({}, 'STATIC', Number.NaN)).toThrow(RangeError);
  });

  it('handles failed, cooldown, and fired attempts immutably', () => {
    const lastFires = { STATIC: 100 };
    const base = {
      typedPattern: 'buzz',
      expectedPattern: 'buzz',
      type: 'STATIC' as const,
      nowMs: 6100,
      lastFires,
    };
    expect(resolveGlitchAttempt({ ...base, nowMs: 200 })).toMatchObject({
      outcome: 'cooldown',
      penalty: 0,
    });
    expect(resolveGlitchAttempt({ ...base, typedPattern: 'hiss' })).toMatchObject({
      outcome: 'failed',
      penalty: 2,
      nextLastFires: lastFires,
    });
    expect(resolveGlitchAttempt(base)).toMatchObject({
      outcome: 'fired',
      penalty: 0,
      nextLastFires: { STATIC: 6100 },
    });
    expect(lastFires.STATIC).toBe(100);
  });

  it('records fires in order and replays a half-open time window', () => {
    const early = { type: 'STATIC' as const, atMs: 10, patternIndex: 1 };
    const late = { type: 'BLACKOUT' as const, atMs: 20, patternIndex: 2 };
    const source = [late];
    const fires = recordGlitchFire(source, early);
    expect(fires).toEqual([early, late]);
    expect(source).toEqual([late]);
    expect(replayGlitchFires(fires, 10, 20)).toEqual([early]);
    expect(replayGlitchFires(fires, 20, 30)).toEqual([late]);
    expect(replayGlitchFires([late, early], 0, 30)).toEqual([early, late]);
  });
});
