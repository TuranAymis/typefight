import { describe, expect, it } from 'vitest';
import { CURSOR_EFFECTS } from '@typefight/texts';
import { resolveCursorEffect } from './cursorEffects';
import { fetchProfile, setCursorEffect } from './profileApi';

describe('cursor effects', () => {
  it('only resolves known unlocked effects', () => {
    expect(resolveCursorEffect('default', [])).toBe('default');
    for (const effect of CURSOR_EFFECTS.filter(({ unlockBadgeId }) => unlockBadgeId !== null)) {
      expect(resolveCursorEffect(effect.id, [])).toBe('default');
      expect(resolveCursorEffect(effect.id, [{ id: effect.unlockBadgeId! }])).toBe(effect.id);
    }
    for (const id of [undefined, null, '', 'missing', {}, 42])
      expect(resolveCursorEffect(id, [])).toBe('default');
  });

  it('sends an authenticated selection and handles failures', async () => {
    expect(
      await setCursorEffect('token', 'pulse', async (url, init) => {
        expect(url).toBe('/api/player/cursor-effect');
        expect(init?.method).toBe('PUT');
        expect(init?.headers).toEqual({
          Authorization: 'Bearer token',
          'Content-Type': 'application/json',
        });
        expect(JSON.parse(String(init?.body))).toEqual({ effectId: 'pulse' });
        return new Response(JSON.stringify({ effectId: 'pulse' }));
      }),
    ).toEqual({ ok: true, effectId: 'pulse' });
    for (const status of [400, 401, 403, 429, 500]) {
      expect(
        await setCursorEffect('token', 'pulse', async () => new Response('{}', { status })),
      ).toEqual({ ok: false, error: 'server' });
    }
    expect(
      await setCursorEffect('token', 'pulse', async () => {
        throw new Error('offline');
      }),
    ).toEqual({ ok: false, error: 'network' });
  });

  it('normalizes missing, locked and unknown profile selections', async () => {
    for (const cursorEffect of [undefined, 'missing', 'pulse']) {
      const result = await fetchProfile(
        'p1',
        async () =>
          new Response(
            JSON.stringify({
              playerId: 'p1',
              nickname: 'Ada',
              rating: 1000,
              bestWpm: 0,
              averageAccuracy: 0,
              duels: {},
              badges: [],
              cursorEffect,
            }),
          ),
      );
      expect(result.ok && result.profile.cursorEffect).toBe('default');
    }
  });
});
