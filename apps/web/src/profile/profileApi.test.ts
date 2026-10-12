import { describe, expect, it } from 'vitest';
import { createRecoveryCode, fetchProfile, recoverProfile, winRate } from './profileApi';

const reply = (status: number, body: unknown) => () =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

const profile = {
  playerId: 'p1',
  nickname: 'Ada',
  rating: 1016,
  sessions: 3,
  bestWpm: 88,
  averageAccuracy: 96.5,
  duels: { played: 4, won: 3, lost: 1, drawn: 0 },
  badges: [{ id: 'first-duel', earnedAt: 5 }],
};

describe('profile api', () => {
  it('reads a profile and rejects malformed bodies', async () => {
    expect(await fetchProfile('p1', reply(200, profile))).toEqual({ ok: true, profile });
    expect(await fetchProfile('p1', reply(200, { nope: 1 }))).toEqual({
      ok: false,
      error: 'server',
    });
    expect(await fetchProfile('p1', () => Promise.reject(new Error('x')))).toEqual({
      ok: false,
      error: 'network',
    });
  });

  it('creates a recovery code with the device token', async () => {
    let auth: unknown;
    const result = await createRecoveryCode('tok', (_url, init) => {
      auth = init?.headers;
      return reply(200, { recoveryCode: 'AAAAA-BBBBB-CCCCC-DDDDD' })();
    });
    expect(auth).toEqual({ Authorization: 'Bearer tok' });
    expect(result).toEqual({ ok: true, code: 'AAAAA-BBBBB-CCCCC-DDDDD' });
  });

  it('maps recover outcomes', async () => {
    const ok = { playerId: 'p1', nickname: 'Ada', deviceToken: 'd'.repeat(64) };
    expect(await recoverProfile('x', reply(200, ok))).toEqual({ ok: true, identity: ok });
    expect(await recoverProfile('x', reply(404, {}))).toEqual({ ok: false, error: 'invalid_code' });
    expect(await recoverProfile('x', reply(429, {}))).toEqual({ ok: false, error: 'rate_limited' });
  });

  it('computes the win rate', () => {
    expect(winRate(profile.duels)).toBe(75);
    expect(winRate({ played: 0, won: 0, lost: 0, drawn: 0 })).toBe(0);
  });
});
