import { create } from 'zustand';
import { validateNickname } from '@typefight/texts';
import type { NicknameError } from '@typefight/texts';
import { indexedDbIdentityStorage } from '../identity/identityStorage';
import type { IdentityStorage } from '../identity/identityStorage';
import { registerPlayer } from '../identity/playerApi';
import type { PlayerIdentity, RegisterResult } from '../identity/playerApi';

export type IdentityError = NicknameError | 'network' | 'server' | 'storage';

export interface IdentityState {
  status: 'unknown' | 'anonymous' | 'ready';
  identity: PlayerIdentity | null;
  error: IdentityError | null;
  saving: boolean;
  restore: () => Promise<void>;
  chooseNickname: (nickname: string) => Promise<boolean>;
}

export interface IdentityDeps {
  storage: IdentityStorage;
  register: (nickname: string) => Promise<RegisterResult>;
}

/** Factory with injectable dependencies so the flow can be tested without a browser or server. */
export const createIdentityStore = (deps: IdentityDeps) =>
  create<IdentityState>((set) => ({
    status: 'unknown',
    identity: null,
    error: null,
    saving: false,
    restore: async () => {
      const stored = await deps.storage.load();
      set(stored ? { status: 'ready', identity: stored } : { status: 'anonymous' });
    },
    chooseNickname: async (nickname) => {
      // Same rules as the server, checked first so obvious mistakes never hit the network.
      const check = validateNickname(nickname);
      if (!check.ok) {
        set({ error: check.error });
        return false;
      }
      set({ saving: true, error: null });
      const result = await deps.register(check.nickname);
      if (!result.ok) {
        set({ saving: false, error: result.error });
        return false;
      }
      try {
        await deps.storage.save(result.identity);
      } catch {
        set({ saving: false, error: 'storage' });
        return false;
      }
      set({ saving: false, status: 'ready', identity: result.identity, error: null });
      return true;
    },
  }));

export const useIdentityStore = createIdentityStore({
  storage: indexedDbIdentityStorage,
  register: (nickname) => registerPlayer(nickname),
});
