import { describe, expect, it } from 'vitest';
import { computeResult } from '../session/scoring';
import { isTypableChar, normalizeTypedText } from '../text/locale';
import type { SessionRecord } from '../session/types';

const record = (
  targetText: string,
  keys: readonly string[],
  durationMs = 60000,
): SessionRecord => ({
  version: 1,
  targetText,
  locale: 'en',
  events: keys.map((key, index) => ({ t: (index + 1) * 100, key })),
  durationMs,
});

describe('computeResult', () => {
  it('counts corrected and uncorrected errors separately', () => {
    const result = computeResult(record('abc', ['a', 'x', 'Backspace', 'b', 'z']));
    expect(result).toMatchObject({
      typedChars: 4,
      correctChars: 2,
      errorChars: 2,
      correctedErrors: 1,
      uncorrectedErrors: 1,
      backspaces: 1,
      accuracy: 50,
    });
  });

  it('ignores backspace on an empty buffer and character input past the end', () => {
    const result = computeResult(record('a', ['Backspace', 'a', 'x']));
    expect(result).toMatchObject({ typedChars: 1, backspaces: 0, errorChars: 0 });
  });

  it('counts effective backspace after a correct character', () => {
    const result = computeResult(record('a', ['a', 'Backspace']));
    expect(result).toMatchObject({
      typedChars: 1,
      correctChars: 0,
      backspaces: 1,
      correctedErrors: 0,
    });
  });

  it('can retype after deleting a full buffer', () => {
    const result = computeResult(record('a', ['a', 'Backspace', 'a']));
    expect(result).toMatchObject({ typedChars: 2, correctChars: 1, backspaces: 1 });
  });

  it('ignores non-character keys', () => {
    expect(computeResult(record('a', ['Shift', 'a'])).typedChars).toBe(1);
  });

  it('returns zero rates for nonpositive duration and too few presses', () => {
    expect(computeResult(record('ab', ['a', 'b'], -1))).toMatchObject({
      wpm: 0,
      rawWpm: 0,
      consistency: 0,
    });
  });

  it('returns zero accuracy for an empty session', () => {
    expect(computeResult(record('a', []))).toMatchObject({ accuracy: 0, consistency: 0 });
  });

  it('returns zero consistency for zero or reversed intervals', () => {
    const zero = {
      ...record('abc', ['a', 'b', 'c']),
      events: [
        { key: 'a', t: 1 },
        { key: 'b', t: 1 },
        { key: 'c', t: 1 },
      ],
    };
    const reversed = {
      ...zero,
      events: [
        { key: 'a', t: 3 },
        { key: 'b', t: 2 },
        { key: 'c', t: 1 },
      ],
    };
    expect(computeResult(zero).consistency).toBe(0);
    expect(computeResult(reversed).consistency).toBe(0);
  });
});

describe('locale helpers', () => {
  it('normalizes Turkish dotted and dotless I correctly', () => {
    expect(normalizeTypedText('Iıiİ', 'tr')).toBe('ııii');
    expect(normalizeTypedText('I', 'en')).toBe('i');
  });

  it('accepts Turkish letters and English lowercase characters', () => {
    for (const char of ['ç', 'ğ', 'ı', 'ö', 'ş', 'ü']) {
      expect(isTypableChar(char, 'tr')).toBe(true);
      expect(isTypableChar(char, 'en')).toBe(false);
    }
    expect(isTypableChar('i', 'tr')).toBe(true);
    expect(isTypableChar(' ', 'en')).toBe(true);
    expect(isTypableChar('İ', 'tr')).toBe(false);
    expect(isTypableChar('ab', 'tr')).toBe(false);
  });

  it('scores Turkish target text with locale-aware case mapping', () => {
    const result = computeResult({ ...record('ış', ['I', 'ş']), locale: 'tr' });
    expect(result).toMatchObject({ correctChars: 2, errorChars: 0, accuracy: 100 });
  });
});
