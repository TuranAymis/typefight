export type { WordListTierMetadata, ContentManifest, TextPassage } from './types';
export { TEXT_POOL, pickPassage, findPassage } from './pool';
export {
  NICKNAME_MIN_LENGTH,
  NICKNAME_MAX_LENGTH,
  containsProfanity,
  validateNickname,
} from './nickname';
export type { NicknameCheck, NicknameError } from './nickname';
export { BADGES, BADGE_MIN_ACCURACY_RUN_MS } from './badges';
export type { BadgeDefinition } from './badges';
export { CURSOR_EFFECTS } from './cursorEffects';
export type { CursorEffectDefinition } from './cursorEffects';

export { ONBOARDING } from './onboarding';
export type { OnboardingContent } from './onboarding';
export { SOUNDS, SOUND_EVENTS } from './sounds';
export type { SoundEvent, SoundTone } from './sounds';
export {
  ANALYTICS_EVENTS,
  CLIENT_ID_PATTERN,
  MAX_EVENTS_PER_REQUEST,
  isAnalyticsEventName,
  validateEventProps,
} from './analyticsEvents';
export type { AnalyticsEventName, AnalyticsProps } from './analyticsEvents';
