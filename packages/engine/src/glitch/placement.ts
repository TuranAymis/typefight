import { GLITCH_POOL, type GlitchEffect } from './pool';
import { createRng } from './rng';

export interface GlitchPlacementInput {
  readonly textId: string;
  readonly seed: number | string;
  readonly targetText: string;
  /** Upper bound on glitches in one text. Default 3. */
  readonly maxGlitches?: number;
  /** Every glitch gets its own slice of at least this many words. Default 6. */
  readonly minSegmentWords?: number;
}

export interface GlitchPlacement {
  readonly id: number;
  /** The glitch string is inserted right before this word of the base text (>= 1). */
  readonly beforeWordIndex: number;
  readonly effect: GlitchEffect;
  readonly string: string;
}

export interface GlitchMarker {
  readonly id: number;
  /** Index of the glitch string among the words of the glitched text. */
  readonly wordIndex: number;
  /** Index of the glitch string's first character in the glitched text. */
  readonly charIndex: number;
  readonly effect: GlitchEffect;
  readonly string: string;
}

export interface GlitchedText {
  readonly text: string;
  readonly markers: readonly GlitchMarker[];
}

/**
 * Deterministic glitch points for a text. The text is cut into equal slices of its word
 * boundaries and one glitch is drawn per slice, so glitches never bunch up. Same
 * textId + seed + text always yields the same placements, on client and server.
 */
export const placeGlitches = (input: GlitchPlacementInput): readonly GlitchPlacement[] => {
  const { textId, seed, targetText, maxGlitches = 3, minSegmentWords = 6 } = input;
  const wordCount = targetText.length === 0 ? 0 : targetText.split(' ').length;
  const boundaries = wordCount - 1;
  const count = Math.min(
    Math.max(Math.floor(maxGlitches), 0),
    Math.floor(boundaries / Math.max(Math.floor(minSegmentWords), 1)),
  );
  if (count <= 0) return [];

  const rng = createRng(textId, seed);
  const segment = Math.floor(boundaries / count);
  const placements: GlitchPlacement[] = [];
  for (let id = 0; id < count; id += 1) {
    const entry = GLITCH_POOL[rng.int(GLITCH_POOL.length)];
    if (!entry) break;
    placements.push({
      id,
      beforeWordIndex: 1 + id * segment + rng.int(segment),
      effect: entry.effect,
      string: entry.string,
    });
  }
  return placements;
};

/**
 * Inserts the glitch strings into the base text as ordinary words and reports where each one
 * ended up, so the typing engine and replay can treat them like any other word.
 */
export const applyGlitches = (
  targetText: string,
  placements: readonly GlitchPlacement[],
): GlitchedText => {
  const baseWords = targetText.length === 0 ? [] : targetText.split(' ');
  const byWord = new Map<number, GlitchPlacement[]>();
  for (const placement of placements) {
    byWord.set(placement.beforeWordIndex, [
      ...(byWord.get(placement.beforeWordIndex) ?? []),
      placement,
    ]);
  }

  const words: string[] = [];
  const markers: GlitchMarker[] = [];
  let charIndex = 0;
  const push = (word: string): number => {
    words.push(word);
    const start = charIndex;
    charIndex += word.length + 1;
    return start;
  };

  baseWords.forEach((word, index) => {
    for (const placement of byWord.get(index) ?? []) {
      markers.push({
        id: placement.id,
        wordIndex: words.length,
        charIndex: push(placement.string),
        effect: placement.effect,
        string: placement.string,
      });
    }
    push(word);
  });
  return { text: words.join(' '), markers };
};
