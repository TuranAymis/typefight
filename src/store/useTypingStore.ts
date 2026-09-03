import { create } from 'zustand';
import {
  createTypingState,
  typingReducer,
  type KeyInput,
  type TypingState,
} from '../engine';

export const DEFAULT_PRACTICE_TEXT = 'the quick brown fox jumps over the lazy dog';

export interface TypingStoreState {
  typingState: TypingState;
  applyBatch: (inputs: readonly KeyInput[]) => void;
  reset: (targetText?: string) => void;
}

export const useTypingStore = create<TypingStoreState>((set) => ({
  typingState: createTypingState(DEFAULT_PRACTICE_TEXT),

  applyBatch: (inputs: readonly KeyInput[]) => {
    if (inputs.length === 0) return;

    set((state) => {
      let nextTypingState = state.typingState;
      for (const input of inputs) {
        nextTypingState = typingReducer(nextTypingState, input);
      }
      return { typingState: nextTypingState };
    });
  },

  reset: (targetText?: string) => {
    set({
      typingState: createTypingState(targetText ?? DEFAULT_PRACTICE_TEXT),
    });
  },
}));
