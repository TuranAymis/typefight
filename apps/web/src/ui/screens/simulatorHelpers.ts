import { computeResult, RECORD_VERSION, type TypingState } from '@typefight/engine';
import { SIMULATOR_WORDS } from '@typefight/texts';

export type SimulatorLocale = 'en' | 'tr';
export type SimulatorDuration = 15 | 30 | 60;

export const createSimulatorText = (locale: SimulatorLocale, seed: number, count = 240): string => {
  const pool = SIMULATOR_WORDS[locale];
  let state = seed >>> 0;
  const words: string[] = [];
  for (let index = 0; index < count; index += 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    words.push(pool[state % pool.length] ?? pool[0] ?? 'word');
  }
  return words.join(' ');
};

export const formatStat = (value: number): string =>
  Number.isFinite(value) ? value.toFixed(1) : '0.0';

export const computeSimulatorStats = (state: TypingState, elapsedMs: number) => {
  const minutes = elapsedMs / 60000;
  return {
    wpm: minutes > 0 ? state.cursorIndex / 5 / minutes : 0,
    accuracy:
      state.totalKeypresses > 0 ? (state.firstAttemptCorrect / state.totalKeypresses) * 100 : 0,
    progress: state.targetText.length > 0 ? (state.cursorIndex / state.targetText.length) * 100 : 0,
  };
};

export const computeSimulatorResult = (
  state: TypingState,
  durationMs: number,
  locale: SimulatorLocale,
) => {
  const acceptedEvents = state.keystrokeLog.map(({ index, timestamp }) => ({
    key: state.targetText[index] ?? '',
    t: timestamp,
  }));
  const base = computeResult({
    version: RECORD_VERSION,
    targetText: state.targetText,
    locale,
    events: acceptedEvents,
    durationMs,
  });
  const minutes = durationMs / 60000;
  return {
    ...base,
    rawWpm: minutes > 0 ? Math.round((state.totalKeypresses / 5 / minutes) * 100) / 100 : 0,
    accuracy:
      state.totalKeypresses > 0
        ? Math.round((state.firstAttemptCorrect / state.totalKeypresses) * 10000) / 100
        : 0,
    typedChars: state.totalKeypresses,
    errorChars: state.totalKeypresses - state.cursorIndex,
  };
};

export const computeChartPoints = (state: TypingState, durationMs: number): number[] => {
  const buckets = Math.max(1, Math.ceil(durationMs / 1000));
  const points = Array.from({ length: buckets }, () => 0);
  for (const record of state.keystrokeLog) {
    const bucket = Math.min(buckets - 1, Math.max(0, Math.floor(record.timestamp / 1000)));
    points[bucket] = (points[bucket] ?? 0) + 12;
  }
  return points;
};
