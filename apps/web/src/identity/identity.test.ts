import { describe, expect, it, vi } from 'vitest';
import { createIdentityStore } from '../store/useIdentityStore';
import type { IdentityStorage } from './identityStorage';
import { registerPlayer } from './playerApi';
import type { PlayerIdentity } from './playerApi';

const identity: PlayerIdentity = {
  playerId: 'p1',
  nickname: 'Speedy',
  deviceToken: 'a'.repeat(64),
};

const memoryStorage = (
  initial: PlayerIdentity | null = null,
): IdentityStorage & { saved: unknown } => {
  const box = { saved: initial };
  return {
    get saved() {
      return box.saved;
    },
    load: async () => box.saved as PlayerIdentity | null,
    save: async (value) => {
      box.saved = value;
    },
  };
};

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status });

describe('registerPlayer', () => {
  it('returns the identity on 201', async () => {
    const fetchFn = vi.fn(async () => json(201, { created: true, ...identity }));
    expect(await registerPlayer('Speedy', fetchFn)).toEqual({ ok: true, identity });
    expect(fetchFn).toHaveBeenCalledWith(
      '/api/player',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ nickname: 'Speedy' }) }),
    );
  });

  it('maps server nickname rejections, network failures and junk to error codes', async () => {
    expect(
      await registerPlayer('x', async () =>
        json(400, { error: 'invalid_nickname', reason: 'profanity' }),
      ),
    ).toEqual({ ok: false, error: 'profanity' });
    expect(
      await registerPlayer('x', async () => {
        throw new Error('offline');
      }),
    ).toEqual({ ok: false, error: 'network' });
    expect(await registerPlayer('x', async () => json(500, {}))).toEqual({
      ok: false,
      error: 'server',
    });
    expect(await registerPlayer('x', async () => json(201, { playerId: 1 }))).toEqual({
      ok: false,
      error: 'server',
    });
  });
});

describe('identity store', () => {
  it('recognises a returning browser from storage without calling the server', async () => {
    const register = vi.fn();
    const store = createIdentityStore({ storage: memoryStorage(identity), register });
    await store.getState().restore();
    expect(store.getState()).toMatchObject({ status: 'ready', identity });
    expect(register).not.toHaveBeenCalled();
  });

  it('starts anonymous when nothing is stored', async () => {
    const store = createIdentityStore({ storage: memoryStorage(), register: vi.fn() });
    await store.getState().restore();
    expect(store.getState().status).toBe('anonymous');
  });

  it('saves a valid nickname and keeps the identity', async () => {
    const storage = memoryStorage();
    const register = vi.fn(async () => ({ ok: true as const, identity }));
    const store = createIdentityStore({ storage, register });
    expect(await store.getState().chooseNickname('  Speedy ')).toBe(true);
    expect(register).toHaveBeenCalledWith('Speedy');
    expect(storage.saved).toEqual(identity);
    expect(store.getState()).toMatchObject({ status: 'ready', error: null, saving: false });
  });

  it('rejects invalid and filtered nicknames locally, before any request', async () => {
    const register = vi.fn();
    const store = createIdentityStore({ storage: memoryStorage(), register });
    for (const [name, error] of [
      ['ab', 'too_short'],
      ['has space', 'invalid_chars'],
      ['siktir', 'profanity'],
    ] as const) {
      expect(await store.getState().chooseNickname(name)).toBe(false);
      expect(store.getState().error).toBe(error);
    }
    expect(register).not.toHaveBeenCalled();
    expect(store.getState().status).toBe('unknown');
  });

  it('surfaces server errors and does not store anything', async () => {
    const storage = memoryStorage();
    const store = createIdentityStore({
      storage,
      register: async () => ({ ok: false as const, error: 'network' as const }),
    });
    expect(await store.getState().chooseNickname('Speedy')).toBe(false);
    expect(store.getState().error).toBe('network');
    expect(storage.saved).toBeNull();
  });

  it('reports a storage failure instead of pretending the profile was saved', async () => {
    const store = createIdentityStore({
      storage: {
        load: async () => null,
        save: async () => {
          throw new Error('blocked');
        },
      },
      register: async () => ({ ok: true as const, identity }),
    });
    expect(await store.getState().chooseNickname('Speedy')).toBe(false);
    expect(store.getState()).toMatchObject({ error: 'storage', identity: null });
  });
});
