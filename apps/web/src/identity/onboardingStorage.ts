import { runIdentityStorage } from './identityStorage';

export interface OnboardingStorage {
  load: () => Promise<boolean>;
  save: () => Promise<void>;
}

// A separate key preserves the player record without requiring a database version bump.
export const indexedDbOnboardingStorage: OnboardingStorage = {
  load: async () =>
    (await runIdentityStorage('readonly', (store) => store.get('onboardingCompleted'))) === true,
  save: async () => {
    await runIdentityStorage('readwrite', (store) => store.put(true, 'onboardingCompleted'));
  },
};
