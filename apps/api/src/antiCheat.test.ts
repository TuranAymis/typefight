import { describe, expect, it } from 'vitest';
import { isHistoricalJump, rhythmFlags } from './antiCheat';

/** Deterministic "human-like" intervals: 80-140 ms with irregular jitter. */
export const humanEvents = (count: number, startMs = 0) => {
  let t = startMs;
  return Array.from({ length: count }, (_, index) => {
    t += 80 + ((index * 37) % 61);
    return { t, key: 'a' };
  });
};

const evenly = (count: number, step: number) =>
  Array.from({ length: count }, (_, index) => ({ t: index * step, key: 'a' }));

describe('rhythmFlags', () => {
  it('passes a human-like run', () => {
    expect(rhythmFlags(humanEvents(60), { wpm: 90 })).toEqual([]);
  });

  it('flags WPM above the cap, but a run just under it is fine', () => {
    expect(rhythmFlags(humanEvents(60), { wpm: 251 })).toContain('wpm_over_cap');
    expect(rhythmFlags(humanEvents(60), { wpm: 250 })).not.toContain('wpm_over_cap');
  });

  it('flags a high share of sub-15ms intervals', () => {
    const burst = Array.from({ length: 40 }, (_, index) => ({ t: index * 5, key: 'a' }));
    expect(rhythmFlags(burst, { wpm: 100 })).toContain('fast_intervals');
    // A couple of near-simultaneous presses (rollover) are not suspicious.
    const rollover = humanEvents(60);
    rollover[10] = { t: (rollover[9]?.t ?? 0) + 5, key: 'a' };
    rollover.splice(11, rollover.length - 11, ...humanEvents(49, (rollover[10]?.t ?? 0) + 1000));
    expect(rhythmFlags(rollover, { wpm: 90 })).not.toContain('fast_intervals');
  });

  it('flags perfectly regular rhythm only when there are enough samples', () => {
    expect(rhythmFlags(evenly(60, 100), { wpm: 100 })).toContain('too_regular');
    expect(rhythmFlags(evenly(10, 100), { wpm: 100 })).not.toContain('too_regular');
  });

  it('does not crash on empty or single-event runs', () => {
    expect(rhythmFlags([], { wpm: 0 })).toEqual([]);
    expect(rhythmFlags([{ t: 1, key: 'a' }], { wpm: 0 })).toEqual([]);
  });
});

describe('isHistoricalJump', () => {
  it('needs enough history before judging', () => {
    expect(isHistoricalJump(200, [40, 40])).toBe(false);
  });

  it('flags a large relative and absolute jump over the player average', () => {
    expect(isHistoricalJump(120, [60, 62, 58])).toBe(true);
  });

  it('allows normal improvement and small absolute gains on low averages', () => {
    expect(isHistoricalJump(70, [60, 62, 58])).toBe(false);
    expect(isHistoricalJump(30, [10, 12, 11])).toBe(false);
  });
});
