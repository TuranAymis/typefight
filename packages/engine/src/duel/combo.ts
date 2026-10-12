import { normalizeTypedText } from '../text/locale';
import type { SessionRecord } from '../session/types';

/** A wrong keypress staggers the typist: words finished during these 500ms deal no damage. */
export const STAGGER_MS = 500;

export interface WordEvent {
  readonly type: 'word';
  readonly t: number;
  readonly wordIndex: number;
  readonly length: number;
  /** True when no wrong keypress (even a later corrected one) happened inside the word. */
  readonly clean: boolean;
  /** Combo after this word was scored. */
  readonly combo: number;
}

export interface ComboResetEvent {
  readonly type: 'combo-reset';
  readonly t: number;
  readonly previousCombo: number;
}

export interface StaggerEvent {
  readonly type: 'stagger';
  readonly t: number;
  readonly endsAt: number;
}

export type ComboEvent = WordEvent | ComboResetEvent | StaggerEvent;

export interface ComboTimeline {
  readonly events: readonly ComboEvent[];
  readonly finalCombo: number;
  readonly maxCombo: number;
}

interface BufferedChar {
  readonly wrongAtPress: boolean;
}

/** wordIndexAt[i] is the word a target position belongs to (a space belongs to the word before it). */
const wordLayout = (target: string): { wordIndexAt: number[]; lengths: number[] } => {
  const wordIndexAt: number[] = [];
  const lengths: number[] = [0];
  for (const char of target) {
    const wordIndex = lengths.length - 1;
    wordIndexAt.push(wordIndex);
    if (char === ' ') lengths.push(0);
    else lengths[wordIndex] = (lengths[wordIndex] ?? 0) + 1;
  }
  return { wordIndexAt, lengths };
};

/**
 * Replays a session and derives combo / stagger events. Pure: the same record always yields the
 * same timeline. Combo grows by one for every word typed without any wrong keypress, drops to
 * zero on any wrong keypress, and a wrong keypress starts a 500ms stagger unless one is already
 * active (no stun-lock). Backspace never restores combo, and a word is only scored the first time
 * it is completed.
 */
export const computeComboTimeline = (record: SessionRecord): ComboTimeline => {
  const target = normalizeTypedText(record.targetText, record.locale);
  const { wordIndexAt, lengths } = wordLayout(target);
  const buffer: BufferedChar[] = [];
  const dirtyWords = new Set<number>();
  const scoredWords = new Set<number>();
  const events: ComboEvent[] = [];
  let combo = 0;
  let maxCombo = 0;
  let staggerEndsAt = Number.NEGATIVE_INFINITY;

  for (const event of record.events) {
    if (event.key === 'Backspace') {
      buffer.pop();
      continue;
    }
    if (event.key.length !== 1 || buffer.length >= target.length) continue;
    const char = normalizeTypedText(event.key, record.locale);
    if (char.length !== 1) continue;

    const position = buffer.length;
    const wordIndex = wordIndexAt[position] ?? 0;
    const wrongAtPress = char !== target[position];
    buffer.push({ wrongAtPress });

    if (wrongAtPress) {
      dirtyWords.add(wordIndex);
      if (combo > 0) events.push({ type: 'combo-reset', t: event.t, previousCombo: combo });
      combo = 0;
      if (event.t >= staggerEndsAt) {
        staggerEndsAt = event.t + STAGGER_MS;
        events.push({ type: 'stagger', t: event.t, endsAt: staggerEndsAt });
      }
      continue;
    }

    const endsWord = target[position] === ' ' || position === target.length - 1;
    if (!endsWord || scoredWords.has(wordIndex)) continue;
    scoredWords.add(wordIndex);
    const clean = !dirtyWords.has(wordIndex);
    if (clean) combo += 1;
    maxCombo = Math.max(maxCombo, combo);
    events.push({
      type: 'word',
      t: event.t,
      wordIndex,
      length: lengths[wordIndex] ?? 0,
      clean,
      combo,
    });
  }

  return { events, finalCombo: combo, maxCombo };
};
