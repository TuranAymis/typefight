import { create } from 'zustand';
import { validateNickname } from '@typefight/texts';
import type { NicknameError } from '@typefight/texts';
import { indexedDbIdentityStorage } from '../identity/identityStorage';
import type { IdentityStorage } from '../identity/identityStorage';
import { registerPlayer } from '../identity/playerApi';
import type { PlayerIdentity, RegisterResult } from '../identity/playerApi';
import { fetchProfile, recoverProfile } from '../profile/profileApi';
import type { Profile } from '../profile/profileApi';
import { resolveCursorEffect } from '../profile/cursorEffects';
import type { RecoverResult } from '../profile/profileApi';

export type IdentityError = NicknameError | 'network' | 'server' | 'storage';
export type RecoverError = 'invalid_code' | 'rate_limited' | 'network' | 'server' | 'storage';

export interface IdentityState {
  cursorEffect: string;
  cursorProfileId: string | null;
  cursorRevision: number;
  applyProfile: (profile: Profile) => void;
  loadCursorEffect: () => Promise<void>;
  status: 'unknown' | 'anonymous' | 'ready';
  identity: PlayerIdentity | null;
  error: IdentityError | null;
  saving: boolean;
  restore: () => Promise<void>;
  recoverError: RecoverError | null;
  chooseNickname: (nickname: string) => Promise<boolean>;
  recoverWithCode: (code: string) => Promise<boolean>;
}

export interface IdentityDeps {
  fetchProfile?: typeof fetchProfile;
  storage: IdentityStorage;
  register: (nickname: string) => Promise<RegisterResult>;
  recover?: (code: string) => Promise<RecoverResult>;
}

/** Factory with injectable dependencies so the flow can be tested without a browser or server. */
export const createIdentityStore = (deps: IdentityDeps) =>
  create<IdentityState>((set, get) => ({
    cursorEffect: 'default',
    cursorProfileId: null,
    cursorRevision: 0,
    applyProfile: (profile) => {
      if (profile.playerId !== get().identity?.playerId) return;
      set({
        cursorEffect: resolveCursorEffect(profile.cursorEffect, profile.badges),
        cursorRevision: get().cursorRevision + 1,
      });
    },
    loadCursorEffect: async () => {
      const playerId = get().identity?.playerId;
      if (!playerId || get().cursorProfileId === playerId) return;
      set({ cursorProfileId: playerId, cursorEffect: 'default' });
      const revision = get().cursorRevision;
      const result = await (deps.fetchProfile ?? fetchProfile)(playerId);
      if (result.ok && get().cursorRevision === revision) get().applyProfile(result.profile);
    },
    status: 'unknown',
    identity: null,
    error: null,
    saving: false,
    recoverError: null,
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
    recoverWithCode: async (code) => {
      set({ saving: true, recoverError: null });
      const result = await (deps.recover ?? recoverProfile)(code);
      if (!result.ok) {
        set({ saving: false, recoverError: result.error });
        return false;
      }
      try {
        await deps.storage.save(result.identity);
      } catch {
        set({ saving: false, recoverError: 'storage' });
        return false;
      }
      set({ saving: false, status: 'ready', identity: result.identity, recoverError: null });
      return true;
    },
  }));

export const useIdentityStore = createIdentityStore({
  storage: indexedDbIdentityStorage,
  register: (nickname) => registerPlayer(nickname),
});
