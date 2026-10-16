import { describe, expect, it, vi } from 'vitest';
import type { SoundStorage } from '../identity/soundStorage';
import { createSoundStore } from './useSoundStore';

const storage = (initial: boolean): SoundStorage & { saved: boolean } => {
  const box = { saved: initial };
  return {
    get saved() {
      return box.saved;
    },
    load: async () => box.saved,
    save: async (muted) => {
      box.saved = muted;
    },
  };
};

describe('sound store', () => {
  it('starts with sound on', () => {
    expect(createSoundStore(storage(true)).getState().muted).toBe(false);
  });

  it('restores a saved mute choice', async () => {
    const store = createSoundStore(storage(true));
    await store.getState().restore();
    expect(store.getState().muted).toBe(true);
  });

  it('toggles and persists each change', async () => {
    const backing = storage(false);
    const store = createSoundStore(backing);
    await store.getState().restore();
    await store.getState().toggle();
    expect(store.getState().muted).toBe(true);
    expect(backing.saved).toBe(true);
    await store.getState().toggle();
    expect(store.getState().muted).toBe(false);
    expect(backing.saved).toBe(false);
  });

  it('reads storage only once however often restore is called', async () => {
    const backing = storage(false);
    const load = vi.fn(backing.load);
    const store = createSoundStore({ ...backing, load });
    await Promise.all([store.getState().restore(), store.getState().restore()]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('still applies the choice for this page load when storage is blocked', async () => {
    const store = createSoundStore({
      load: async () => {
        throw new Error('blocked');
      },
      save: async () => {
        throw new Error('blocked');
      },
    });
    await store.getState().restore();
    expect(store.getState().muted).toBe(false);
    await store.getState().toggle();
    expect(store.getState().muted).toBe(true);
  });
});
