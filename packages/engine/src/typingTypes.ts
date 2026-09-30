/**
 * Typing Engine Type Definitions
 *
 * All text typed in the game conforms to spec section 2.1:
 * lowercase 'a'-'z' and space ' ' only.
 */

export interface KeyInput {
  readonly key: string;
  readonly timestamp: number;
}

export interface KeystrokeRecord {
  readonly index: number;
  readonly timestamp: number;
}

export interface TypingState {
  readonly targetText: string;
  readonly cursorIndex: number;
  readonly totalKeypresses: number;
  readonly firstAttemptCorrect: number;
  readonly erroredAtCurrentIndex: boolean;
  readonly keystrokeLog: readonly KeystrokeRecord[];
  readonly isComplete: boolean;
}
