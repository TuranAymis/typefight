export { isValidKey, createTypingState, typingReducer } from './typingReducer';
export type { KeyInput, KeystrokeRecord, TypingState } from './typingTypes';
export { RECORD_VERSION } from './session/types';
export type { KeyEvent, SessionRecord, SessionResult, DamageEvent } from './session/types';
export { computeResult } from './session/scoring';
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
