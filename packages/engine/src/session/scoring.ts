import { normalizeTypedText } from '../text/locale';
import type { SessionRecord, SessionResult } from './types';

interface BufferedChar {
  readonly char: string;
  readonly wrongAtPress: boolean;
}

const round = (value: number): number =>
  Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;

const computeConsistency = (times: readonly number[]): number => {
  // Fewer than three character presses have insufficient timing samples.
  if (times.length < 3) return 0;
  const intervals: number[] = [];
  for (let index = 1; index < times.length; index += 1) {
    const interval = (times[index] ?? 0) - (times[index - 1] ?? 0);
    if (!Number.isFinite(interval) || interval < 0) return 0;
    intervals.push(interval);
  }
  const mean = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
  if (mean <= 0 || !Number.isFinite(mean)) return 0;
  const variance =
    intervals.reduce((sum, value) => sum + (value - mean) ** 2, 0) / intervals.length;
  const deviation = Math.sqrt(variance);
  return round(100 * (1 - Math.min(1, deviation / mean)));
};

export const computeResult = (record: SessionRecord): SessionResult => {
  const target = normalizeTypedText(record.targetText, record.locale);
  const buffer: BufferedChar[] = [];
  const times: number[] = [];
  let typedChars = 0;
  let errorChars = 0;
  let correctedErrors = 0;
  let backspaces = 0;

  for (const event of record.events) {
    if (event.key === 'Backspace') {
      const removed = buffer.pop();
      if (removed) {
        backspaces += 1;
        if (removed.wrongAtPress) correctedErrors += 1;
      }
      continue;
    }
    if (event.key.length !== 1 || buffer.length >= target.length) continue;
    const char = normalizeTypedText(event.key, record.locale);
    if (char.length !== 1) continue;
    const wrongAtPress = char !== target[buffer.length];
    buffer.push({ char, wrongAtPress });
    typedChars += 1;
    if (wrongAtPress) errorChars += 1;
    times.push(event.t);
  }

  const correctChars = buffer.reduce(
    (count, entry, index) => count + (entry.char === target[index] ? 1 : 0),
    0,
  );
  const uncorrectedErrors = buffer.length - correctChars;
  const minutes = record.durationMs / 60000;
  return {
    wpm: round(minutes > 0 ? correctChars / 5 / minutes : 0),
    rawWpm: round(minutes > 0 ? typedChars / 5 / minutes : 0),
    // Empty sessions have 0% accuracy because no keypress was measured.
    accuracy: round(typedChars > 0 ? (100 * (typedChars - errorChars)) / typedChars : 0),
    consistency: computeConsistency(times),
    typedChars: round(typedChars),
    correctChars: round(correctChars),
    errorChars: round(errorChars),
    uncorrectedErrors: round(uncorrectedErrors),
    correctedErrors: round(correctedErrors),
    backspaces: round(backspaces),
    durationMs: round(record.durationMs),
  };
};
