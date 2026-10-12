import { describe, expect, it } from 'vitest';
import { recordGlitchFires, glitchFiresBetween } from '../glitch/fires';
import { applyGlitches, type GlitchMarker, type GlitchPlacement } from '../glitch/placement';
import type { SessionRecord } from '../session/types';

const record = (targetText: string, keys: readonly string[], msPerKey = 100): SessionRecord => ({
  version: 1,
  targetText,
  locale: 'en',
  events: keys.map((key, index) => ({ t: (index + 1) * msPerKey, key })),
  durationMs: keys.length * msPerKey,
});

const deepFreeze = (value: object): void => {
  for (const child of Object.values(value)) {
    if (child !== null && typeof child === 'object') deepFreeze(child);
  }
  Object.freeze(value);
};

const glitched = (placements: readonly GlitchPlacement[]) =>
  applyGlitches('alpha beta gamma delta epsilon zeta eta theta iota kappa', placements);

const typeWithCorrectedMistakeAt = (text: string, charIndex: number): readonly string[] => {
  const keys: string[] = [];
  for (let index = 0; index < text.length; index += 1) {
    if (index === charIndex) {
      keys.push(text[index] === 'x' ? 'y' : 'x', 'Backspace');
    }
    keys.push(text[index] ?? '');
  }
  return keys;
};

describe('recordGlitchFires', () => {
  it('fires a clean glitch word', () => {
    const applied = glitched([{ id: 0, beforeWordIndex: 1, effect: 'static', string: 'noise' }]);
    const fires = recordGlitchFires(record(applied.text, [...applied.text]), applied.markers);

    expect(fires).toEqual([
      { t: 1200, glitchId: 0, effect: 'static', outcome: 'fired', penalty: 0 },
    ]);
  });

  it('fails a glitch word on any wrong key even when corrected with Backspace', () => {
    const applied = glitched([{ id: 0, beforeWordIndex: 1, effect: 'static', string: 'noise' }]);
    const marker = applied.markers[0] as GlitchMarker;
    const fires = recordGlitchFires(
      record(applied.text, typeWithCorrectedMistakeAt(applied.text, marker.charIndex)),
      applied.markers,
    );

    expect(fires).toEqual([
      { t: 1400, glitchId: 0, effect: 'static', outcome: 'failed', penalty: 3 },
    ]);
  });

  it('puts repeated effects on cooldown with zero penalty', () => {
    const applied = glitched([
      { id: 0, beforeWordIndex: 1, effect: 'static', string: 'noise' },
      { id: 1, beforeWordIndex: 2, effect: 'static', string: 'fuzz' },
    ]);

    expect(recordGlitchFires(record(applied.text, [...applied.text]), applied.markers)).toEqual([
      { t: 1200, glitchId: 0, effect: 'static', outcome: 'fired', penalty: 0 },
      { t: 2200, glitchId: 1, effect: 'static', outcome: 'cooldown', penalty: 0 },
    ]);
  });

  it('fires the same effect again after cooldown', () => {
    const applied = glitched([
      { id: 0, beforeWordIndex: 1, effect: 'static', string: 'noise' },
      { id: 1, beforeWordIndex: 2, effect: 'static', string: 'fuzz' },
    ]);

    expect(
      recordGlitchFires(record(applied.text, [...applied.text], 1000), applied.markers),
    ).toEqual([
      { t: 12000, glitchId: 0, effect: 'static', outcome: 'fired', penalty: 0 },
      { t: 22000, glitchId: 1, effect: 'static', outcome: 'fired', penalty: 0 },
    ]);
  });

  it('tracks cooldown independently per effect', () => {
    const applied = glitched([
      { id: 0, beforeWordIndex: 1, effect: 'static', string: 'noise' },
      { id: 1, beforeWordIndex: 2, effect: 'blackout', string: 'void' },
    ]);

    expect(recordGlitchFires(record(applied.text, [...applied.text]), applied.markers)).toEqual([
      { t: 1200, glitchId: 0, effect: 'static', outcome: 'fired', penalty: 0 },
      { t: 2200, glitchId: 1, effect: 'blackout', outcome: 'fired', penalty: 0 },
    ]);
  });

  it('does not start cooldown for a failed glitch', () => {
    const applied = glitched([
      { id: 0, beforeWordIndex: 1, effect: 'static', string: 'noise' },
      { id: 1, beforeWordIndex: 2, effect: 'static', string: 'fuzz' },
    ]);
    const firstMarker = applied.markers[0] as GlitchMarker;

    expect(
      recordGlitchFires(
        record(applied.text, typeWithCorrectedMistakeAt(applied.text, firstMarker.charIndex)),
        applied.markers,
      ),
    ).toEqual([
      { t: 1400, glitchId: 0, effect: 'static', outcome: 'failed', penalty: 3 },
      { t: 2400, glitchId: 1, effect: 'static', outcome: 'fired', penalty: 0 },
    ]);
  });

  it('omits unreached glitch words', () => {
    const applied = glitched([{ id: 0, beforeWordIndex: 2, effect: 'static', string: 'noise' }]);
    const beforeGlitch = applied.text.slice(0, (applied.markers[0] as GlitchMarker).charIndex);

    expect(recordGlitchFires(record(applied.text, [...beforeGlitch]), applied.markers)).toEqual([]);
  });

  it('supports custom GlitchRules', () => {
    const applied = glitched([
      { id: 0, beforeWordIndex: 1, effect: 'static', string: 'noise' },
      { id: 1, beforeWordIndex: 2, effect: 'static', string: 'fuzz' },
    ]);
    const firstMarker = applied.markers[0] as GlitchMarker;

    expect(
      recordGlitchFires(
        record(applied.text, typeWithCorrectedMistakeAt(applied.text, firstMarker.charIndex)),
        applied.markers,
        { cooldownMs: 1, failPenalty: 9 },
      ),
    ).toEqual([
      { t: 1400, glitchId: 0, effect: 'static', outcome: 'failed', penalty: 9 },
      { t: 2400, glitchId: 1, effect: 'static', outcome: 'fired', penalty: 0 },
    ]);
  });

  it('is deterministic with deep-frozen inputs', () => {
    const applied = glitched([
      { id: 0, beforeWordIndex: 1, effect: 'static', string: 'noise' },
      { id: 1, beforeWordIndex: 3, effect: 'blackout', string: 'void' },
    ]);
    const session = record(applied.text, [...applied.text]);
    const baseline = JSON.stringify(recordGlitchFires(session, applied.markers));

    deepFreeze(session);
    deepFreeze(applied.markers);

    for (let iteration = 0; iteration < 100; iteration += 1) {
      expect(JSON.stringify(recordGlitchFires(session, applied.markers))).toBe(baseline);
    }
  });
});

describe('glitchFiresBetween', () => {
  it('is exclusive at afterT, inclusive at upToT, and returns only fired outcomes', () => {
    const fires = [
      { t: 100, glitchId: 0, effect: 'static' as const, outcome: 'fired' as const, penalty: 0 },
      { t: 200, glitchId: 1, effect: 'static' as const, outcome: 'cooldown' as const, penalty: 0 },
      { t: 300, glitchId: 2, effect: 'blackout' as const, outcome: 'fired' as const, penalty: 0 },
    ];

    expect(glitchFiresBetween(fires, 100, 300)).toEqual([fires[2]]);
  });

  it('triggers each fire exactly once across consecutive windows', () => {
    const fires = [
      { t: 100, glitchId: 0, effect: 'static' as const, outcome: 'fired' as const, penalty: 0 },
      { t: 200, glitchId: 1, effect: 'blackout' as const, outcome: 'fired' as const, penalty: 0 },
      { t: 300, glitchId: 2, effect: 'scramble' as const, outcome: 'fired' as const, penalty: 0 },
    ];
    const triggered = [
      ...glitchFiresBetween(fires, 0, 100),
      ...glitchFiresBetween(fires, 100, 200),
      ...glitchFiresBetween(fires, 200, 300),
    ];

    expect(triggered).toEqual(fires);
  });
});
