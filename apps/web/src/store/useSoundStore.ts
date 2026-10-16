import { create } from 'zustand';
import { indexedDbSoundStorage, type SoundStorage } from '../identity/soundStorage';

interface SoundState {
  muted: boolean;
  restore: () => Promise<void>;
  toggle: () => Promise<void>;
}

export const createSoundStore = (storage: SoundStorage) => {
  let restoring: Promise<void> | undefined;
  return create<SoundState>((set, get) => ({
    // Sound is on until the player says otherwise.
    muted: false,
    restore: () =>
      (restoring ??= (async () => {
        try {
          set({ muted: await storage.load() });
        } catch {
          // Storage blocked: keep the default for this page load.
        }
      })()),
    toggle: async () => {
      const muted = !get().muted;
      set({ muted });
      try {
        await storage.save(muted);
      } catch {
        // The choice still applies for this page load.
      }
    },
  }));
};

export const useSoundStore = createSoundStore(indexedDbSoundStorage);
