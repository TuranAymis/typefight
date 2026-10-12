import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './index';
import { LEADERBOARD_CACHE_MS, clearLeaderboardCache } from './routes/leaderboard';
import { createTestDb, type TestDb } from './test/d1';

const DAY = 24 * 60 * 60 * 1000;
let db: TestDb;
let now = 10 * DAY + 12 * 60 * 60 * 1000; // noon UTC on day 10
const app = createApp(() => now);

const get = async (query: string, token?: string) => {
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await app.request(`/api/leaderboard${query}`, { headers }, { DB: db.d1 });
  return {
    status: response.status,
    cache: response.headers.get('Cache-Control'),
    json: (await response.json()) as {
      entries: { rank: number; nickname: string; wpm: number }[];
      me?: { rank: number; nickname: string } | null;
      error?: string;
    },
  };
};

let counter = 0;
const addPlayer = async (nickname: string) => {
  const response = await app.request(
    '/api/player',
    {
      method: 'POST',
      body: JSON.stringify({ nickname }),
      headers: { 'Content-Type': 'application/json' },
    },
    { DB: db.d1 },
  );
  const body = (await response.json()) as { playerId: string; deviceToken: string };
  return { id: body.playerId, token: body.deviceToken };
};

const addRun = (
  playerId: string,
  wpm: number,
  options: { lang?: string; verified?: number; accuracy?: number; at?: number } = {},
) => {
  counter += 1;
  db.raw
    .prepare(
      `INSERT INTO sessions (id, player_id, mode, lang, text_id, target_text, seed, token_hash, status,
         started_at, submitted_at, wpm, accuracy, verified)
       VALUES (?, ?, 'simulator', ?, 'x', 'x', 1, 'h', 'submitted', 0, ?, ?, ?, ?)`,
    )
    .run(
      `r${counter}`,
      playerId,
      options.lang ?? 'en',
      options.at ?? now - 1000,
      wpm,
      options.accuracy ?? 97,
      options.verified ?? 1,
    );
};

beforeEach(() => {
  db = createTestDb();
  now = 10 * DAY + 12 * 60 * 60 * 1000;
  counter = 0;
  clearLeaderboardCache();
});

describe('GET /api/leaderboard', () => {
  it('ranks each player once by their best verified run, highest first', async () => {
    const a = await addPlayer('Alice');
    const b = await addPlayer('Bobby');
    const c = await addPlayer('Carol');
    addRun(a.id, 80);
    addRun(a.id, 95);
    addRun(b.id, 100);
    addRun(c.id, 60);
    const { json } = await get('?lang=en&period=all');
    expect(json.entries.map((e) => [e.rank, e.nickname, e.wpm])).toEqual([
      [1, 'Bobby', 100],
      [2, 'Alice', 95],
      [3, 'Carol', 60],
    ]);
  });

  it('leaves out unverified runs, low accuracy, bots and other languages', async () => {
    const a = await addPlayer('Alice');
    const cheat = await addPlayer('Cheater');
    const sloppy = await addPlayer('Sloppy');
    const tr = await addPlayer('Turkce');
    addRun(a.id, 70);
    addRun(cheat.id, 300, { verified: 0 });
    addRun(sloppy.id, 200, { accuracy: 80 });
    addRun(tr.id, 150, { lang: 'tr' });
    db.raw
      .prepare(
        "INSERT INTO players (id, nickname, token_hash, is_bot, created_at) VALUES ('b', '[BOT] 150', 'bh', 1, 0)",
      )
      .run();
    addRun('b', 150);
    expect((await get('?lang=en')).json.entries.map((e) => e.nickname)).toEqual(['Alice']);
    expect((await get('?lang=tr')).json.entries.map((e) => e.nickname)).toEqual(['Turkce']);
  });

  it('daily only counts runs since UTC midnight, all-time counts everything', async () => {
    const a = await addPlayer('Alice');
    const b = await addPlayer('Bobby');
    addRun(a.id, 120, { at: 10 * DAY - 1 }); // yesterday 23:59:59.999
    addRun(a.id, 70, { at: 10 * DAY + 1000 });
    addRun(b.id, 90, { at: 10 * DAY + 2000 });
    const daily = await get('?period=daily');
    expect(daily.json.entries.map((e) => [e.nickname, e.wpm])).toEqual([
      ['Bobby', 90],
      ['Alice', 70],
    ]);
    const all = await get('?period=all');
    expect(all.json.entries.map((e) => [e.nickname, e.wpm])).toEqual([
      ['Alice', 120],
      ['Bobby', 90],
    ]);
  });

  it('breaks ties by nickname and respects the limit', async () => {
    for (const name of ['Zed', 'Amy', 'Bob']) addRun((await addPlayer(name)).id, 80);
    const { json } = await get('?limit=2');
    expect(json.entries.map((e) => e.nickname)).toEqual(['Amy', 'Bob']);
  });

  it('caches the public list for 60 seconds', async () => {
    const a = await addPlayer('Alice');
    addRun(a.id, 70);
    const first = await get('');
    expect(first.cache).toBe('public, max-age=60');
    addRun((await addPlayer('Bobby')).id, 90);
    expect((await get('')).json.entries).toHaveLength(1);
    now += LEADERBOARD_CACHE_MS;
    expect((await get('')).json.entries).toHaveLength(2);
  });

  it('adds the caller own rank even outside the list, without leaking it into the cache', async () => {
    const players = [];
    for (const [name, wpm] of [
      ['Aaa', 90],
      ['Bbb', 80],
      ['Ccc', 70],
      ['Ddd', 60],
    ] as const) {
      const p = await addPlayer(name);
      addRun(p.id, wpm);
      players.push(p);
    }
    const last = players[3]!;
    const mine = await get('?limit=2', last.token);
    expect(mine.json.entries).toHaveLength(2);
    expect(mine.json.me).toMatchObject({ rank: 4, nickname: 'Ddd' });
    expect(mine.cache).toBe('private, max-age=60');
    const anonymous = await get('?limit=2');
    expect(anonymous.json.me).toBeUndefined();
    const unranked = await addPlayer('Newb');
    expect((await get('?limit=2', unranked.token)).json.me).toBeNull();
  });

  it('validates query parameters', async () => {
    expect((await get('?lang=de')).status).toBe(400);
    expect((await get('?period=weekly')).status).toBe(400);
    expect((await get('?limit=0')).status).toBe(400);
    expect((await get('?limit=101')).status).toBe(400);
    expect((await get('?limit=abc')).status).toBe(400);
  });
});
