import { describe, expect, it } from 'vitest';
import { createTypingState, typingReducer } from '@typefight/engine';
import {
  computeChartPoints,
  computeSimulatorResult,
  computeSimulatorStats,
  createSimulatorText,
  formatStat,
} from './simulatorHelpers';

describe('simulator helpers', () => {
  it('generates deterministic distinct locale streams with valid characters', () => {
    const english = createSimulatorText('en', 42, 12);
    const turkish = createSimulatorText('tr', 42, 12);
    expect(createSimulatorText('en', 42, 12)).toBe(english);
    expect(turkish).not.toBe(english);
    expect(english).toMatch(/^[a-z ]+$/);
    expect(turkish).toMatch(/^[a-z ]+$/);
  });

  it('has finite idle values and scores blocking mistakes', () => {
    let state = createTypingState('ab');
    expect(computeSimulatorStats(state, 0)).toEqual({ wpm: 0, accuracy: 0, progress: 0 });
    state = typingReducer(state, { key: 'x', timestamp: 0 });
    state = typingReducer(state, { key: 'a', timestamp: 100 });
    const live = computeSimulatorStats(state, 1000);
    expect(live.accuracy).toBe(0);
    expect(live.wpm).toBe(12);
    const result = computeSimulatorResult(state, 1000, 'en');
    expect(result.wpm).toBe(12);
    expect(result.rawWpm).toBe(24);
    expect(result.accuracy).toBe(0);
    expect(result.errorChars).toBe(1);
    expect(formatStat(Number.NaN)).toBe('0.0');
  });

  it('bins accepted keystrokes into per-second WPM points', () => {
    let state = createTypingState('abc');
    state = typingReducer(state, { key: 'a', timestamp: 0 });
    state = typingReducer(state, { key: 'b', timestamp: 1100 });
    state = typingReducer(state, { key: 'c', timestamp: 1200 });
    expect(computeChartPoints(state, 3000)).toEqual([12, 24, 0]);
  });
});
