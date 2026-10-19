import { GLITCH_CONFIG } from '@typefight/texts';
import type { SessionRecord } from '../session/types';
import { recordGlitchFires, type GlitchFire } from './fires';
import type { GlitchMarker } from './placement';

export interface DuelGlitch {
  readonly version: number;
  readonly markers: readonly GlitchMarker[];
}

/** Records without a glitch version retain their original rules. Fires are always derived. */
export const sessionGlitchFires = (record: SessionRecord): readonly GlitchFire[] =>
  record.glitch?.version === GLITCH_CONFIG.version
    ? recordGlitchFires(record, record.glitch.markers)
    : [];

export interface ActiveGlitch {
  readonly fire: GlitchFire;
  readonly remainingMs: number;
}

/** Half-open intervals: an effect is absent at its exact expiry, even after skipped frames. */
export const activeGlitches = (fires: readonly GlitchFire[], t: number): readonly ActiveGlitch[] =>
  fires.flatMap((fire) => {
    if (fire.outcome !== 'fired' || fire.effect === 'overclock' || fire.t > t) return [];
    const remainingMs = fire.t + GLITCH_CONFIG.durationMs[fire.effect] - t;
    return remainingMs > 0 ? [{ fire, remainingMs }] : [];
  });

/** The attacker boosts the next three scored words; the triggering word is excluded.
 * Word order, rather than timestamps, also handles multiple completions in one millisecond.
 */
export const overclockWordIndices = (record: SessionRecord): readonly number[] => {
  const wordCount = record.targetText.split(' ').length;
  const indices = new Set<number>();
  for (const fire of sessionGlitchFires(record)) {
    if (fire.outcome !== 'fired' || fire.effect !== 'overclock') continue;
    const marker = record.glitch?.markers.find((entry) => entry.id === fire.glitchId);
    if (!marker) continue;
    for (let offset = 1; offset <= GLITCH_CONFIG.overclockWords; offset += 1) {
      const index = marker.wordIndex + offset;
      if (index < wordCount) indices.add(index);
    }
  }
  return [...indices];
};
