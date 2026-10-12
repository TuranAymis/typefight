/* eslint-disable @typescript-eslint/no-explicit-any -- test responses are loosely typed JSON */
import { BADGES } from '@typefight/texts';
import { beforeEach, describe, expect, it } from 'vitest';
import { awardBadges } from './badges';
import { createApp } from './index';
import { createTestDb, type TestDb } from './test/d1';

let db: TestDb;
let now = 7_000_000;
const app = createApp(() => now);

const call = async (
  method: string,
  path: string,
  options: { token?: string; body?: unknown } = {},
): Promise<{ status: number; json: Record<string, any> }> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  const init: RequestInit = { method, headers };
  if (options.body !== undefined) init.body = JSON.stringify(options.body);
  const response = await app.request(path, init, { DB: db.d1 });
  return { status: response.status, json: (await response.json()) as Record<string, any> };
};

const createPlayer = async () => {
  const response = await call('POST', '/api/player', { body: {} });
  return { token: response.json.deviceToken as string, id: response.json.playerId as string };
};

const addRun = (
  playerId: string,
  options: { wpm?: number; accuracy?: number; durationMs?: number; verified?: number } = {},
) =>
  db.raw
    .prepare(
      `INSERT INTO sessions (id, player_id, mode, lang, text_id, target_text, seed, token_hash, status,
         started_at, submitted_at, duration_ms, wpm, accuracy, verified)
       VALUES (?, ?, 'simulator', 'en', 'en-001', 't', 1, 'h', 'submitted', 0, 1, ?, ?, ?, ?)`,
    )
    .run(
      crypto.randomUUID(),
      playerId,
      options.durationMs ?? 20_000,
      options.wpm ?? 40,
      options.accuracy ?? 90,
      options.verified ?? 1,
    );

const addDuels = (playerId: string, won: number, lost = 0) => {
  const insert = db.raw.prepare(
    'INSERT INTO duels (id, player_id, winner, created_at) VALUES (?, ?, ?, 1)',
  );
  for (let i = 0; i < won; i += 1) insert.run(crypto.randomUUID(), playerId, 'player');
  for (let i = 0; i < lost; i += 1) insert.run(crypto.randomUUID(), playerId, 'opponent');
};

const earned = (playerId: string): string[] =>
  (
    db.raw
      .prepare('SELECT badge_id FROM badges WHERE player_id = ? ORDER BY badge_id')
      .all(playerId) as { badge_id: string }[]
  ).map((row) => row.badge_id);

beforeEach(() => {
  db = createTestDb();
  now = 7_000_000;
});

describe('badge definitions', () => {
  it('has ten unique badges', () => {
    expect(BADGES).toHaveLength(10);
    expect(new Set(BADGES.map((badge) => badge.id)).size).toBe(10);
  });
});

describe('awardBadges', () => {
  it('awards nothing to a new player', async () => {
    const me = await createPlayer();
    expect(await awardBadges(db.d1, me.id, now)).toEqual([]);
  });

  it('awards duel badges at their thresholds and each only once', async () => {
    const me = await createPlayer();
    addDuels(me.id, 0, 1);
    expect((await awardBadges(db.d1, me.id, now)).map((b) => b.id)).toEqual(['first-duel']);
    addDuels(me.id, 1);
    expect((await awardBadges(db.d1, me.id, now)).map((b) => b.id)).toEqual(['first-win']);
    expect(await awardBadges(db.d1, me.id, now)).toEqual([]);
    addDuels(me.id, 9);
    expect((await awardBadges(db.d1, me.id, now)).map((b) => b.id)).toEqual(['wins-10']);
    addDuels(me.id, 40);
    expect((await awardBadges(db.d1, me.id, now)).map((b) => b.id)).toEqual(['wins-50']);
    expect(earned(me.id)).toEqual(['first-duel', 'first-win', 'wins-10', 'wins-50']);
  });

  it('awards every reached WPM tier at once from verified runs only', async () => {
    const me = await createPlayer();
    addRun(me.id, { wpm: 400, verified: 0 });
    expect(await awardBadges(db.d1, me.id, now)).toEqual([]);
    addRun(me.id, { wpm: 100 });
    expect((await awardBadges(db.d1, me.id, now)).map((b) => b.id)).toEqual([
      'wpm-50',
      'wpm-75',
      'wpm-100',
    ]);
  });

  it('accuracy badges need a run of at least 10 seconds', async () => {
    const me = await createPlayer();
    addRun(me.id, { accuracy: 100, durationMs: 4_000 });
    expect(await awardBadges(db.d1, me.id, now)).toEqual([]);
    addRun(me.id, { accuracy: 96, durationMs: 12_000 });
    expect((await awardBadges(db.d1, me.id, now)).map((b) => b.id)).toEqual(['accuracy-95']);
    addRun(me.id, { accuracy: 99, durationMs: 12_000 });
    expect((await awardBadges(db.d1, me.id, now)).map((b) => b.id)).toEqual(['accuracy-99']);
  });
});

describe('badges over the API', () => {
  it('lists earned badges on the profile', async () => {
    const me = await createPlayer();
    addDuels(me.id, 1);
    await awardBadges(db.d1, me.id, now);
    const profile = await call('GET', `/api/profile/${me.id}`);
    expect(profile.json.badges.map((b: any) => b.id)).toEqual(['first-duel', 'first-win']);
    expect(profile.json.badges[0].earnedAt).toBe(now);
  });

  it('reports new badges once in the duel result', async () => {
    const me = await createPlayer();
    const started = await call('POST', '/api/duel/start', {
      token: me.token,
      body: { lang: 'en' },
    });
    now += 120_000;
    let t = 200;
    const events = [...(started.json.text as string)].map((key, index) => {
      t += Math.round(60 * (0.8 + ((index * 37) % 41) / 100));
      return { t, key };
    });
    const submit = {
      sessionId: started.json.sessionId,
      sessionToken: started.json.sessionToken,
      events,
      durationMs: t + 30,
    };
    const result = await call('POST', '/api/duel/submit', { token: me.token, body: submit });
    expect(result.status).toBe(200);
    expect(result.json.newBadges.map((b: any) => b.id)).toContain('first-duel');
    expect(result.json.newBadges.map((b: any) => b.id)).toContain('first-win');
    expect(earned(me.id)).toContain('first-win');
  });
});
