import { describe, expect, it } from 'vitest';
import { fetchLeaderboard } from './leaderboardApi';

const entry = { rank: 1, playerId: 'p1', nickname: 'Ada', wpm: 90, accuracy: 98 };
const reply = (status: number, body: unknown) => () =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

describe('fetchLeaderboard', () => {
  it('returns entries in server order and the caller rank', async () => {
    const second = { ...entry, rank: 2, playerId: 'p2', nickname: 'Bo', wpm: 80 };
    const result = await fetchLeaderboard(
      'en',
      'all',
      undefined,
      reply(200, { entries: [entry, second], me: second }),
    );
    expect(result).toEqual({ ok: true, board: { entries: [entry, second], me: second } });
  });

  it('sends the token, query and drops malformed rows', async () => {
    let seen: { url: string; init: RequestInit | undefined } | undefined;
    const result = await fetchLeaderboard('tr', 'daily', 'abc', (url, init) => {
      seen = { url, init };
      return reply(200, { entries: [entry, { rank: 'x' }] })();
    });
    expect(seen?.url).toBe('/api/leaderboard?lang=tr&period=daily');
    expect(seen?.init?.headers).toEqual({ Authorization: 'Bearer abc' });
    expect(result).toEqual({ ok: true, board: { entries: [entry], me: null } });
  });

  it('reports network and server failures', async () => {
    const down = () => Promise.reject(new Error('offline'));
    expect(await fetchLeaderboard('en', 'all', undefined, down)).toEqual({
      ok: false,
      error: 'network',
    });
    expect(await fetchLeaderboard('en', 'all', undefined, reply(500, {}))).toEqual({
      ok: false,
      error: 'server',
    });
  });
});
