import { runIdentityStorage } from './identityStorage';

export interface SoundStorage {
  load: () => Promise<boolean>;
  save: (muted: boolean) => Promise<void>;
}

// Same IndexedDB store as the identity (localStorage is not allowed), under its own key.
export const indexedDbSoundStorage: SoundStorage = {
  load: async () =>
    (await runIdentityStorage('readonly', (store) => store.get('soundMuted'))) === true,
  save: async (muted) => {
    await runIdentityStorage('readwrite', (store) => store.put(muted, 'soundMuted'));
  },
};
