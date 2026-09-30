import type { KeyInput, TypingState } from './typingTypes';

const TARGET_TEXT_REGEX = /^[a-z ]*$/;

/**
 * Validates whether an incoming key event represents a valid character in the
 * TypeFight character set (spec 2.1: lowercase 'a'-'z' and space ' ').
 *
 * Any other key (e.g. Shift, Enter, Backspace, arrows, digits, punctuation,
 * uppercase) is NOT an event and must not affect any game state or counters.
 */
export const isValidKey = (key: string): boolean => {
  return key.length === 1 && ((key >= 'a' && key <= 'z') || key === ' ');
};

/**
 * Creates the initial TypingState for a given target text.
 * Throws an Error if target text contains characters outside the allowed character set.
 */
export const createTypingState = (targetText: string): TypingState => {
  if (!TARGET_TEXT_REGEX.test(targetText)) {
    throw new Error(
      `Invalid target text: "${targetText}". Target text must contain lowercase 'a'-'z' and space only.`,
    );
  }

  return {
    targetText,
    cursorIndex: 0,
    totalKeypresses: 0,
    firstAttemptCorrect: 0,
    erroredAtCurrentIndex: false,
    keystrokeLog: [],
    isComplete: targetText.length === 0,
  };
};

/**
 * Pure typing reducer conforming to spec section 2.1.
 *
 * Deterministic: Does not read system clock or generate entropy.
 * All timestamps are explicitly passed in via KeyInput.
 */
export const typingReducer = (state: TypingState, input: KeyInput): TypingState => {
  // Input after completion is a no-op
  if (state.isComplete) {
    return state;
  }

  // Non-charset keys (Shift, Enter, arrows, digits, uppercase, etc.) are ignored
  if (!isValidKey(input.key)) {
    return state;
  }

  const expectedChar = state.targetText[state.cursorIndex];
  if (expectedChar === undefined) {
    return state;
  }

  // Correct key: cursor advances
  if (input.key === expectedChar) {
    const nextCursorIndex = state.cursorIndex + 1;
    const isFirstAttempt = !state.erroredAtCurrentIndex;

    return {
      ...state,
      cursorIndex: nextCursorIndex,
      totalKeypresses: state.totalKeypresses + 1,
      firstAttemptCorrect: isFirstAttempt
        ? state.firstAttemptCorrect + 1
        : state.firstAttemptCorrect,
      erroredAtCurrentIndex: false,
      keystrokeLog: [
        ...state.keystrokeLog,
        { index: state.cursorIndex, timestamp: input.timestamp },
      ],
      isComplete: nextCursorIndex >= state.targetText.length,
    };
  }

  // Wrong key: ignored (cursor does not move), counts toward keypresses, marks error
  return {
    ...state,
    totalKeypresses: state.totalKeypresses + 1,
    erroredAtCurrentIndex: true,
  };
};
