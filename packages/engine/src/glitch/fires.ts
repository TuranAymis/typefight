import { computeComboTimeline } from '../duel/combo';
import type { SessionRecord } from '../session/types';
import type { GlitchMarker } from './placement';
import type { GlitchEffect } from './pool';

export interface GlitchRules {
  /** The same effect cannot fire again until this long after its last successful fire. */
  readonly cooldownMs: number;
  /** Damage the attacker takes for mistyping a glitch string. */
  readonly failPenalty: number;
}

export const DEFAULT_GLITCH_RULES: GlitchRules = { cooldownMs: 8000, failPenalty: 3 };

/**
 * fired:    glitch string typed without a single wrong key, effect applies to the opponent.
 * failed:   any wrong key inside the glitch string cancels the attack and costs `penalty`.
 * cooldown: typed correctly but the effect is still cooling down, so nothing is produced.
 */
export type GlitchOutcome = 'fired' | 'failed' | 'cooldown';

export interface GlitchFire {
  /** Time of the keypress that finished the glitch string. */
  readonly t: number;
  readonly glitchId: number;
  readonly effect: GlitchEffect;
  readonly outcome: GlitchOutcome;
  readonly penalty: number;
}

/**
 * Derives the glitchFires log from a session. `record.targetText` must be the glitched text
 * (see applyGlitches) that `markers` refer to. A glitch only produces an entry once its string
 * is finished; strings the player never reached are absent. Pure and deterministic, so the
 * server re-derives exactly what the client showed.
 */
export const recordGlitchFires = (
  record: SessionRecord,
  markers: readonly GlitchMarker[],
  rules: GlitchRules = DEFAULT_GLITCH_RULES,
): readonly GlitchFire[] => {
  const markerByWord = new Map(markers.map((marker) => [marker.wordIndex, marker]));
  const lastFired = new Map<GlitchEffect, number>();
  const fires: GlitchFire[] = [];

  for (const event of computeComboTimeline(record).events) {
    if (event.type !== 'word') continue;
    const marker = markerByWord.get(event.wordIndex);
    if (!marker) continue;
    const base = { t: event.t, glitchId: marker.id, effect: marker.effect };

    if (!event.clean) {
      fires.push({ ...base, outcome: 'failed', penalty: rules.failPenalty });
      continue;
    }
    const previous = lastFired.get(marker.effect);
    if (previous !== undefined && event.t - previous < rules.cooldownMs) {
      fires.push({ ...base, outcome: 'cooldown', penalty: 0 });
      continue;
    }
    lastFired.set(marker.effect, event.t);
    fires.push({ ...base, outcome: 'fired', penalty: 0 });
  }
  return fires;
};

/**
 * Replay helper: the fires a ghost triggers while the replay clock moves from `afterT`
 * (exclusive) to `upToT` (inclusive). Only successful fires produce an effect. Call it once per
 * tick with the previous and current replay time to trigger each event exactly once.
 */
export const glitchFiresBetween = (
  fires: readonly GlitchFire[],
  afterT: number,
  upToT: number,
): readonly GlitchFire[] =>
  fires.filter((fire) => fire.outcome === 'fired' && fire.t > afterT && fire.t <= upToT);
