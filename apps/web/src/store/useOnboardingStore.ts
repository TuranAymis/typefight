import { create } from 'zustand';
import { indexedDbOnboardingStorage, type OnboardingStorage } from '../identity/onboardingStorage';

interface OnboardingState {
  onboardingCompleted: boolean | null;
  shownThisSession: boolean;
  restore: () => Promise<void>;
  markShown: () => void;
  complete: () => Promise<void>;
}

export const createOnboardingStore = (storage: OnboardingStorage) => {
  let restoring: Promise<void> | undefined;
  return create<OnboardingState>((set, get) => ({
    onboardingCompleted: null,
    shownThisSession: false,
    restore: () =>
      (restoring ??= (async () => {
        let completed = false;
        try {
          completed = await storage.load();
        } catch {
          /* Continue offline. */
        }
        if (get().onboardingCompleted === null) set({ onboardingCompleted: completed });
      })()),
    markShown: () => set({ shownThisSession: true }),
    complete: async () => {
      set({ onboardingCompleted: true, shownThisSession: true });
      try {
        await storage.save();
      } catch {
        /* Keep completion for this page load. */
      }
    },
  }));
};

export const useOnboardingStore = createOnboardingStore(indexedDbOnboardingStorage);
