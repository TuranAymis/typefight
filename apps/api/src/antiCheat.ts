import type { KeyEvent, SessionResult } from '@typefight/engine';

/** Suspicious sessions are stored with verified = 0: never blocked, just kept out of ghost/leaderboard pools. */
export type SuspicionFlag = 'fast_intervals' | 'wpm_over_cap' | 'too_regular' | 'wpm_jump';

export const MIN_HUMAN_INTERVAL_MS = 15;
/** Share of key intervals below MIN_HUMAN_INTERVAL_MS above which the run looks automated. */
export const MAX_FAST_INTERVAL_RATIO = 0.1;
export const WPM_CAP = 250;
/** Coefficient of variation (std / mean of intervals) below this is "too perfect" for a human. */
export const MIN_RHYTHM_VARIATION = 0.04;
export const MIN_EVENTS_FOR_RHYTHM = 30;
export const MIN_HISTORY_FOR_JUMP = 3;
export const JUMP_FACTOR = 1.75;
export const JUMP_MIN_ABSOLUTE_WPM = 30;

const intervalsOf = (events: readonly KeyEvent[]): number[] => {
  const intervals: number[] = [];
  for (let index = 1; index < events.length; index += 1) {
    intervals.push((events[index]?.t ?? 0) - (events[index - 1]?.t ?? 0));
  }
  return intervals;
};

export const rhythmFlags = (
  events: readonly KeyEvent[],
  result: Pick<SessionResult, 'wpm'>,
): SuspicionFlag[] => {
  const flags: SuspicionFlag[] = [];
  const intervals = intervalsOf(events);

  if (result.wpm > WPM_CAP) flags.push('wpm_over_cap');

  if (intervals.length >= 10) {
    const fast = intervals.filter((interval) => interval < MIN_HUMAN_INTERVAL_MS).length;
    if (fast / intervals.length > MAX_FAST_INTERVAL_RATIO) flags.push('fast_intervals');
  }

  if (events.length >= MIN_EVENTS_FOR_RHYTHM) {
    const mean = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
    if (mean > 0) {
      const variance =
        intervals.reduce((sum, value) => sum + (value - mean) ** 2, 0) / intervals.length;
      if (Math.sqrt(variance) / mean < MIN_RHYTHM_VARIATION) flags.push('too_regular');
    }
  }
  return flags;
};

/** Compares a new result with the player's own verified history. Needs a few samples to say anything. */
export const isHistoricalJump = (wpm: number, previousWpms: readonly number[]): boolean => {
  if (previousWpms.length < MIN_HISTORY_FOR_JUMP) return false;
  const average = previousWpms.reduce((sum, value) => sum + value, 0) / previousWpms.length;
  return wpm > average * JUMP_FACTOR && wpm - average > JUMP_MIN_ABSOLUTE_WPM;
};
