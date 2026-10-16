import { describe, expect, it, vi } from 'vitest';
import type { OnboardingStorage } from '../identity/onboardingStorage';
import { createOnboardingStore } from './useOnboardingStore';

const storage = (initial: boolean): OnboardingStorage & { saved: boolean } => {
  const box = { saved: initial };
  return {
    get saved() {
      return box.saved;
    },
    load: async () => box.saved,
    save: async () => {
      box.saved = true;
    },
  };
};

describe('onboarding store', () => {
  it('is unknown until restored, then mirrors the stored flag', async () => {
    const store = createOnboardingStore(storage(true));
    expect(store.getState().onboardingCompleted).toBeNull();
    await store.getState().restore();
    expect(store.getState().onboardingCompleted).toBe(true);
  });

  it('treats a first visit as not completed', async () => {
    const store = createOnboardingStore(storage(false));
    await store.getState().restore();
    expect(store.getState().onboardingCompleted).toBe(false);
    expect(store.getState().shownThisSession).toBe(false);
  });

  it('loads from storage only once however often restore is called', async () => {
    const backing = storage(false);
    const load = vi.fn(backing.load);
    const store = createOnboardingStore({ ...backing, load });
    await Promise.all([store.getState().restore(), store.getState().restore()]);
    await store.getState().restore();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('fails open when storage is unavailable', async () => {
    const store = createOnboardingStore({
      load: async () => {
        throw new Error('blocked');
      },
      save: async () => {
        throw new Error('blocked');
      },
    });
    await store.getState().restore();
    expect(store.getState().onboardingCompleted).toBe(false);
    await store.getState().complete();
    expect(store.getState().onboardingCompleted).toBe(true);
    expect(store.getState().shownThisSession).toBe(true);
  });

  it('persists completion and marks the tutorial as shown this session', async () => {
    const backing = storage(false);
    const store = createOnboardingStore(backing);
    await store.getState().restore();
    store.getState().markShown();
    expect(store.getState().shownThisSession).toBe(true);
    await store.getState().complete();
    expect(backing.saved).toBe(true);
    expect(store.getState().onboardingCompleted).toBe(true);
  });
});
