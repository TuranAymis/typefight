export { isValidKey, createTypingState, typingReducer } from './typingReducer';
export type { KeyInput, KeystrokeRecord, TypingState } from './typingTypes';
export { RECORD_VERSION } from './session/types';
export type { KeyEvent, SessionRecord, SessionResult, DamageEvent } from './session/types';
export { computeResult } from './session/scoring';
export { STAGGER_MS, computeComboTimeline } from './duel/combo';
export type {
  ComboEvent,
  ComboResetEvent,
  ComboTimeline,
  StaggerEvent,
  WordEvent,
} from './duel/combo';
export { COMBO_BONUS_PERCENT, MAX_COMBO_BONUS, computeDamage } from './duel/damage';
export type { DamageInput } from './duel/damage';
export { DEFAULT_DUEL_CONFIG, simulateDuel } from './duel/simulate';
export type { DuelConfig, DuelOutcomeReason, DuelResult, DuelWinner } from './duel/simulate';
export { createRng } from './glitch/rng';
export type { Rng } from './glitch/rng';
export { GLITCH_POOL } from './glitch/pool';
export type { GlitchEffect, GlitchString } from './glitch/pool';
export { applyGlitches, placeGlitches } from './glitch/placement';
export type {
  GlitchMarker,
  GlitchPlacement,
  GlitchPlacementInput,
  GlitchedText,
} from './glitch/placement';
export { DEFAULT_GLITCH_RULES, glitchFiresBetween, recordGlitchFires } from './glitch/fires';
export type { GlitchFire, GlitchOutcome, GlitchRules } from './glitch/fires';
export { INITIAL_RATING, K_FACTOR, MIN_RATING, expectedScore, updateRatings } from './rating/elo';
export type { DuelScore, RatingUpdate } from './rating/elo';
export { normalizeTypedText, isTypableChar } from './text/locale';
export type { Locale } from './text/locale';

export interface EngineVersionInfo {
  readonly name: string;
  readonly version: string;
  readonly pure: true;
}

export const ENGINE_INFO: EngineVersionInfo = {
  name: 'TypeFight Core Engine',
  version: '0.1.0',
  pure: true,
};

export { tutorialView } from './onboarding';

export { activeGlitches, sessionGlitchFires, overclockWordIndices } from './glitch/timeline';
export type { DuelGlitch, ActiveGlitch } from './glitch/timeline';
