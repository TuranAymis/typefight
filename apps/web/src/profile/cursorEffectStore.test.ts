import { expect, it, vi } from 'vitest';
import { createIdentityStore } from '../store/useIdentityStore';
import type { Profile } from './profileApi';

const identity = { playerId: 'p1', nickname: 'Ada', deviceToken: 'a'.repeat(64) };
const profile: Profile = {
  playerId: 'p1',
  nickname: 'Ada',
  rating: 1000,
  sessions: 0,
  bestWpm: 0,
  averageAccuracy: 0,
  duels: { played: 0, won: 0, lost: 0, drawn: 0 },
  badges: [{ id: 'first-win', earnedAt: 1 }],
  cursorEffect: 'pulse',
};
const storage = { load: async () => identity, save: async () => {} };

it('loads once for a restored identity and ignores other profiles', async () => {
  const fetchProfile = vi.fn(async () => ({ ok: true as const, profile }));
  const store = createIdentityStore({ storage, register: vi.fn(), fetchProfile });
  await store.getState().restore();
  await Promise.all([store.getState().loadCursorEffect(), store.getState().loadCursorEffect()]);
  expect(fetchProfile).toHaveBeenCalledTimes(1);
  expect(store.getState().cursorEffect).toBe('pulse');
  store.getState().applyProfile({ ...profile, playerId: 'other', cursorEffect: 'default' });
  expect(store.getState().cursorEffect).toBe('pulse');
});

it('does not overwrite a newer selection with a late startup response', async () => {
  let finish: ((value: { ok: true; profile: Profile }) => void) | undefined;
  const store = createIdentityStore({
    storage,
    register: vi.fn(),
    fetchProfile: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  await store.getState().restore();
  const loading = store.getState().loadCursorEffect();
  store.getState().applyProfile(profile);
  finish?.({ ok: true, profile: { ...profile, cursorEffect: 'default' } });
  await loading;
  expect(store.getState().cursorEffect).toBe('pulse');
});

it('silently retains default when the startup request fails', async () => {
  const store = createIdentityStore({
    storage,
    register: vi.fn(),
    fetchProfile: async () => ({ ok: false, error: 'network' }),
  });
  await store.getState().restore();
  await store.getState().loadCursorEffect();
  expect(store.getState()).toMatchObject({ cursorEffect: 'default', error: null });
});
