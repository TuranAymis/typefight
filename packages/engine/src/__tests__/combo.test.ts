import { describe, expect, it } from 'vitest';
import { computeComboTimeline, STAGGER_MS } from '../duel/combo';
import type { SessionRecord } from '../session/types';

const record = (
  targetText: string,
  keys: readonly string[],
  locale: SessionRecord['locale'] = 'en',
): SessionRecord => ({
  version: 1,
  targetText,
  locale,
  events: keys.map((key, index) => ({ t: (index + 1) * 100, key })),
  durationMs: keys.length * 100,
});

describe('computeComboTimeline', () => {
  it('increments combo for each clean word and scores the final word without trailing space', () => {
    const timeline = computeComboTimeline(record('one two', [...'one two']));

    expect(timeline.events.filter((event) => event.type === 'word')).toEqual([
      { type: 'word', t: 400, wordIndex: 0, length: 3, clean: true, combo: 1 },
      { type: 'word', t: 700, wordIndex: 1, length: 3, clean: true, combo: 2 },
    ]);
    expect(timeline.finalCombo).toBe(2);
    expect(timeline.maxCombo).toBe(2);
  });

  it('resets an active combo once on wrong key and starts one stagger window', () => {
    const timeline = computeComboTimeline(record('ab cd', ['a', 'b', ' ', 'x', 'y', 'c', 'd']));

    expect(timeline.events).toEqual([
      { type: 'word', t: 300, wordIndex: 0, length: 2, clean: true, combo: 1 },
      { type: 'combo-reset', t: 400, previousCombo: 1 },
      { type: 'stagger', t: 400, endsAt: 400 + STAGGER_MS },
    ]);
    expect(timeline.finalCombo).toBe(0);
    expect(timeline.maxCombo).toBe(1);
  });

  it('does not emit combo-reset when combo is already zero or a second stagger while active', () => {
    const timeline = computeComboTimeline(record('abc', ['x', 'y', 'z']));

    expect(timeline.events).toEqual([{ type: 'stagger', t: 100, endsAt: 100 + STAGGER_MS }]);
    expect(timeline.finalCombo).toBe(0);
  });

  it('treats a backspace-corrected word as dirty and never scores the same word twice', () => {
    const timeline = computeComboTimeline(
      record('ab cd', ['a', 'x', 'Backspace', 'b', ' ', 'c', 'd']),
    );

    expect(timeline.events).toEqual([
      { type: 'stagger', t: 200, endsAt: 200 + STAGGER_MS },
      { type: 'word', t: 500, wordIndex: 0, length: 2, clean: false, combo: 0 },
      { type: 'word', t: 700, wordIndex: 1, length: 2, clean: true, combo: 1 },
    ]);
    expect(timeline.finalCombo).toBe(1);
  });

  it('normalizes Turkish target text with Turkish locale', () => {
    const timeline = computeComboTimeline(record('\u0131\u015f', ['I', '\u015f'], 'tr'));

    expect(timeline.events).toEqual([
      { type: 'word', t: 200, wordIndex: 0, length: 2, clean: true, combo: 1 },
    ]);
  });
});
