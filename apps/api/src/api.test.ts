import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './index';
import { DURATION_TOLERANCE_MS, SESSION_TTL_MS } from './routes/session';
import { humanEvents } from './antiCheat.test';
import { MAX_NEW_PLAYERS_PER_IP, MAX_STARTS_PER_PLAYER, START_WINDOW_MS } from './rateLimit';
import { createTestDb, type TestDb } from './test/d1';

let db: TestDb;
let now = 1_000_000;
const app = createApp(() => now);

const call = async (
  method: string,
  path: string,
  options: { token?: string; body?: unknown; ip?: string; env?: Record<string, string> } = {},
): Promise<{ status: number; json: Record<string, unknown> }> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.ip) headers['CF-Connecting-IP'] = options.ip;
  const init: RequestInit = { method, headers };
  if (options.body !== undefined) init.body = JSON.stringify(options.body);
  const response = await app.request(path, init, {
    DB: db.d1,
    ...options.env,
  });
  return { status: response.status, json: (await response.json()) as Record<string, unknown> };
};

const createPlayer = async (nickname?: string) => {
  const response = await call('POST', '/api/player', {
    body: nickname === undefined ? {} : { nickname },
  });
  return response;
};

const typeAll = (text: string, startMs = 0, stepMs = 100) =>
  [...text].map((key, index) => ({ t: startMs + index * stepMs, key }));

beforeEach(() => {
  db = createTestDb();
  now = 1_000_000;
});

describe('POST /api/player', () => {
  it('creates an anonymous player and stores only the token hash', async () => {
    const response = await createPlayer('Speedy_Fox');
    expect(response.status).toBe(201);
    const token = response.json.deviceToken as string;
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    const row = db.raw.prepare('SELECT * FROM players').get() as { token_hash: string };
    expect(row.token_hash).not.toBe(token);
    expect(row.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(row)).not.toContain(token);
  });

  it('generates a nickname when none is given', async () => {
    const response = await createPlayer();
    expect(response.status).toBe(201);
    expect(response.json.nickname).toMatch(/^Typist-[0-9a-f]{4}$/);
  });

  it('recognises the same browser by its device token without creating a second player', async () => {
    const first = await createPlayer('Speedy_Fox');
    const again = await call('POST', '/api/player', { token: first.json.deviceToken as string });
    expect(again.status).toBe(200);
    expect(again.json.created).toBe(false);
    expect(again.json.playerId).toBe(first.json.playerId);
    expect(again.json.deviceToken).toBeUndefined();
    expect(db.raw.prepare('SELECT COUNT(*) AS n FROM players').get()).toEqual({ n: 1 });
  });

  it('rejects bad and profane nicknames without creating a player', async () => {
    for (const nickname of ['ab', 'x'.repeat(17), 'has space', 'f_u_c_k', 'AMK', 'siktir']) {
      const response = await createPlayer(nickname);
      expect(response.status, nickname).toBe(400);
      expect(response.json.error).toBe('invalid_nickname');
    }
    expect((await call('POST', '/api/player', { body: { nickname: 42 } })).status).toBe(400);
    expect(db.raw.prepare('SELECT COUNT(*) AS n FROM players').get()).toEqual({ n: 0 });
  });

  it('lets a recognised player change the nickname, with the same checks', async () => {
    const created = await createPlayer('Speedy_Fox');
    const token = created.json.deviceToken as string;
    expect(
      (await call('PATCH', '/api/player/nickname', { body: { nickname: 'Aa1' } })).status,
    ).toBe(401);
    expect(
      (await call('PATCH', '/api/player/nickname', { token, body: { nickname: 'shit' } })).status,
    ).toBe(400);
    const ok = await call('PATCH', '/api/player/nickname', {
      token,
      body: { nickname: 'Yeni_Ad' },
    });
    expect(ok.status).toBe(200);
    expect(ok.json.nickname).toBe('Yeni_Ad');
  });
});

describe('POST /api/session/start', () => {
  it('requires a device token', async () => {
    expect((await call('POST', '/api/session/start', { body: {} })).status).toBe(401);
    expect(
      (await call('POST', '/api/session/start', { token: 'f'.repeat(64), body: {} })).status,
    ).toBe(401);
  });

  it('returns a server-chosen text, seed and session token in the requested language', async () => {
    const token = (await createPlayer()).json.deviceToken as string;
    const response = await call('POST', '/api/session/start', {
      token,
      body: { mode: 'simulator', lang: 'tr' },
    });
    expect(response.status).toBe(201);
    expect(response.json.textId).toMatch(/^tr-/);
    expect(typeof response.json.text).toBe('string');
    expect(typeof response.json.seed).toBe('number');
    expect(response.json.sessionToken).toMatch(/^[0-9a-f]{64}$/);
    const row = db.raw.prepare('SELECT token_hash FROM sessions').get() as { token_hash: string };
    expect(row.token_hash).not.toBe(response.json.sessionToken);
  });

  it('rejects unknown modes and languages', async () => {
    const token = (await createPlayer()).json.deviceToken as string;
    expect(
      (await call('POST', '/api/session/start', { token, body: { mode: 'pit' } })).status,
    ).toBe(400);
    expect((await call('POST', '/api/session/start', { token, body: { lang: 'de' } })).status).toBe(
      400,
    );
  });
});

describe('POST /api/session/submit', () => {
  const startSession = async (lang: 'en' | 'tr' = 'en') => {
    const created = await createPlayer();
    const token = created.json.deviceToken as string;
    const started = await call('POST', '/api/session/start', { token, body: { lang } });
    return {
      token,
      playerId: created.json.playerId as string,
      sessionId: started.json.sessionId as string,
      sessionToken: started.json.sessionToken as string,
      text: started.json.text as string,
    };
  };

  it('recomputes the result on the server and stores it', async () => {
    const s = await startSession();
    now += 60_000;
    const events = typeAll(s.text);
    const durationMs = events.length * 100;
    const response = await call('POST', '/api/session/submit', {
      token: s.token,
      body: { sessionId: s.sessionId, sessionToken: s.sessionToken, events, durationMs },
    });
    expect(response.status).toBe(200);
    const result = response.json.result as { accuracy: number; wpm: number };
    expect(result.accuracy).toBe(100);
    expect(result.wpm).toBeGreaterThan(0);
    const row = db.raw.prepare('SELECT * FROM sessions').get() as {
      status: string;
      wpm: number;
      accuracy: number;
    };
    expect(row.status).toBe('submitted');
    expect(row.wpm).toBe(result.wpm);
  });

  it('ignores client-reported scores: the official result comes from the events', async () => {
    const s = await startSession();
    now += 60_000;
    const events = typeAll('zzzz zzzz zzzz', 0, 100);
    const response = await call('POST', '/api/session/submit', {
      token: s.token,
      body: {
        sessionId: s.sessionId,
        sessionToken: s.sessionToken,
        events,
        durationMs: 1500,
        result: { wpm: 999, accuracy: 100 },
        wpm: 999,
        accuracy: 100,
      },
    });
    expect(response.status).toBe(200);
    const result = response.json.result as { wpm: number; accuracy: number };
    expect(result.wpm).toBeLessThan(200);
    expect(result.accuracy).toBeLessThan(100);
    const row = db.raw.prepare('SELECT wpm FROM sessions').get() as { wpm: number };
    expect(row.wpm).toBe(result.wpm);
  });

  it('refuses a second submit of the same session', async () => {
    const s = await startSession();
    now += 60_000;
    const body = {
      sessionId: s.sessionId,
      sessionToken: s.sessionToken,
      events: typeAll(s.text),
      durationMs: s.text.length * 100,
    };
    expect((await call('POST', '/api/session/submit', { token: s.token, body })).status).toBe(200);
    expect((await call('POST', '/api/session/submit', { token: s.token, body })).status).toBe(409);
  });

  it('rejects a wrong session token and sessions of other players', async () => {
    const s = await startSession();
    now += 60_000;
    const body = {
      sessionId: s.sessionId,
      sessionToken: 'a'.repeat(64),
      events: typeAll('abc'),
      durationMs: 300,
    };
    expect((await call('POST', '/api/session/submit', { token: s.token, body })).status).toBe(403);
    const other = (await createPlayer()).json.deviceToken as string;
    const stolen = { ...body, sessionToken: s.sessionToken };
    expect((await call('POST', '/api/session/submit', { token: other, body: stolen })).status).toBe(
      404,
    );
  });

  it('rejects expired sessions and durations longer than the elapsed server time', async () => {
    const s = await startSession();
    const body = {
      sessionId: s.sessionId,
      sessionToken: s.sessionToken,
      events: typeAll('abc'),
      durationMs: 300,
    };
    now += DURATION_TOLERANCE_MS + 10_000;
    const lying = { ...body, events: typeAll('abc'), durationMs: 600_000 };
    expect(
      (await call('POST', '/api/session/submit', { token: s.token, body: lying })).status,
    ).toBe(422);
    now += SESSION_TTL_MS;
    expect((await call('POST', '/api/session/submit', { token: s.token, body })).status).toBe(410);
  });

  it('rejects malformed records', async () => {
    const s = await startSession();
    now += 60_000;
    const base = { sessionId: s.sessionId, sessionToken: s.sessionToken, durationMs: 1000 };
    const bad: unknown[] = [
      { ...base, events: 'nope' },
      {
        ...base,
        events: [
          { t: 5, key: 'a' },
          { t: 1, key: 'b' },
        ],
      },
      { ...base, events: [{ t: 1, key: '' }] },
      { ...base, events: [{ t: 1, key: 'a' }], durationMs: -1 },
      { ...base, events: [{ t: 5000, key: 'a' }], durationMs: 1000 },
      { events: [] },
    ];
    for (const body of bad) {
      const response = await call('POST', '/api/session/submit', { token: s.token, body });
      expect([400, 422]).toContain(response.status);
    }
    expect(db.raw.prepare('SELECT status FROM sessions').get()).toEqual({ status: 'started' });
  });
});

describe('GET /api/profile/:id', () => {
  it('returns zeros for a player without sessions and 404 for unknown ids', async () => {
    const created = await createPlayer('Newbie');
    const profile = await call('GET', `/api/profile/${created.json.playerId as string}`);
    expect(profile.status).toBe(200);
    expect(profile.json).toMatchObject({
      nickname: 'Newbie',
      sessions: 0,
      bestWpm: 0,
      averageAccuracy: 0,
      duels: { played: 0, won: 0, lost: 0, drawn: 0 },
    });
    expect((await call('GET', '/api/profile/unknown')).status).toBe(404);
  });

  it('computes best WPM, average accuracy and the duel summary from D1', async () => {
    const created = await createPlayer('Veteran');
    const playerId = created.json.playerId as string;
    const insertSession = db.raw.prepare(
      `INSERT INTO sessions (id, player_id, mode, lang, text_id, target_text, seed, token_hash, status, started_at, wpm, accuracy)
       VALUES (?, ?, 'simulator', 'en', 'en-001', 'x', 1, 'h', ?, 0, ?, ?)`,
    );
    insertSession.run('s1', playerId, 'submitted', 60, 100);
    insertSession.run('s2', playerId, 'submitted', 80, 95);
    insertSession.run('s3', playerId, 'started', 200, 10);
    const insertDuel = db.raw.prepare(
      'INSERT INTO duels (id, player_id, winner, created_at) VALUES (?, ?, ?, 0)',
    );
    insertDuel.run('d1', playerId, 'player');
    insertDuel.run('d2', playerId, 'player');
    insertDuel.run('d3', playerId, 'opponent');
    insertDuel.run('d4', playerId, 'draw');

    const profile = await call('GET', `/api/profile/${playerId}`);
    expect(profile.json).toMatchObject({
      sessions: 2,
      bestWpm: 80,
      averageAccuracy: 97.5,
      duels: { played: 4, won: 2, lost: 1, drawn: 1 },
    });
    expect(JSON.stringify(profile.json)).not.toContain('token');
  });
});

describe('schema', () => {
  it('has the ghost-query indexes and refuses orphan rows', () => {
    const indexes = db.raw
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%'")
      .all()
      .map((row) => (row as { name: string }).name);
    expect(indexes).toEqual(
      expect.arrayContaining(['idx_sessions_ghost', 'idx_sessions_player', 'idx_duels_player']),
    );
    expect(() =>
      db.raw
        .prepare("INSERT INTO badges (player_id, badge_id, earned_at) VALUES ('nobody', 'b', 0)")
        .run(),
    ).toThrow();
  });
});

describe('anti-abuse', () => {
  const start = async (token: string, ip?: string) =>
    call('POST', '/api/session/start', {
      token,
      body: { lang: 'en' },
      ...(ip ? { ip } : {}),
    });

  it('rate limits session starts per player and tells the client when to retry', async () => {
    const token = (await createPlayer()).json.deviceToken as string;
    for (let i = 0; i < MAX_STARTS_PER_PLAYER; i += 1) {
      expect((await start(token)).status).toBe(201);
    }
    expect((await start(token)).status).toBe(429);
    now += START_WINDOW_MS + 1;
    expect((await start(token)).status).toBe(201);
  });

  it('rate limits session starts per IP across different players', async () => {
    const ip = '203.0.113.7';
    const players: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      players.push(
        (await call('POST', '/api/player', { body: {}, ip })).json.deviceToken as string,
      );
    }
    let status = 201;
    for (let i = 0; i < 61 && status === 201; i += 1) {
      status = (await start(players[i % 3] as string, ip)).status;
    }
    expect(status).toBe(429);
    // A fresh player on the same IP is blocked too; the same IP limit does not hit other IPs.
    const fresh = (await call('POST', '/api/player', { body: {}, ip: '198.51.100.9' })).json
      .deviceToken as string;
    expect((await start(fresh, ip)).status).toBe(429);
    expect((await start(fresh, '198.51.100.9')).status).toBe(201);
  });

  it('limits account creation per IP and never stores the raw IP', async () => {
    const ip = '203.0.113.50';
    for (let i = 0; i < MAX_NEW_PLAYERS_PER_IP; i += 1) {
      expect((await call('POST', '/api/player', { body: {}, ip })).status).toBe(201);
    }
    const blocked = await call('POST', '/api/player', { body: {}, ip });
    expect(blocked.status).toBe(429);
    expect(blocked.json.error).toBe('rate_limited');
    const rows = db.raw.prepare('SELECT ip_hash FROM players').all() as { ip_hash: string }[];
    expect(rows.every((row) => row.ip_hash !== null && !row.ip_hash.includes('203'))).toBe(true);
  });

  it('does not limit account creation when DISABLE_PLAYER_LIMIT is "1" (staging and local dev)', async () => {
    const ip = '203.0.113.60';
    const env = { DISABLE_PLAYER_LIMIT: '1' };
    for (let i = 0; i < MAX_NEW_PLAYERS_PER_IP + 3; i += 1) {
      expect((await call('POST', '/api/player', { body: {}, ip, env })).status).toBe(201);
    }
  });

  const submitWith = async (events: { t: number; key: string }[]) => {
    const created = await createPlayer();
    const token = created.json.deviceToken as string;
    const started = await start(token);
    now += 120_000;
    return call('POST', '/api/session/submit', {
      token,
      body: {
        sessionId: started.json.sessionId,
        sessionToken: started.json.sessionToken,
        events,
        durationMs: (events[events.length - 1]?.t ?? 0) + 50,
      },
    });
  };

  it('marks automated-looking runs unverified without blocking the player', async () => {
    const robot = Array.from({ length: 80 }, (_, index) => ({ t: 100 + index * 100, key: 'a' }));
    const response = await submitWith(robot);
    expect(response.status).toBe(200);
    expect(response.json.verified).toBe(false);
    expect(response.json.flags).toBeUndefined();
    expect(db.raw.prepare('SELECT verified, flags FROM sessions').get()).toMatchObject({
      verified: 0,
      flags: 'too_regular',
    });
  });

  it('keeps human-like runs verified', async () => {
    const response = await submitWith(humanEvents(80));
    expect(response.status).toBe(200);
    expect(response.json.verified).toBe(true);
  });

  it('flags a sudden jump over the player history and keeps it out of profile bests', async () => {
    const created = await createPlayer('Climber');
    const token = created.json.deviceToken as string;
    const playerId = created.json.playerId as string;
    const insert = db.raw.prepare(
      `INSERT INTO sessions (id, player_id, mode, lang, text_id, target_text, seed, token_hash, status, started_at, submitted_at, wpm, accuracy, verified)
       VALUES (?, ?, 'simulator', 'en', 'en-001', 'x', 1, 'h', 'submitted', 0, ?, ?, 98, 1)`,
    );
    insert.run('h1', playerId, 1, 40);
    insert.run('h2', playerId, 2, 42);
    insert.run('h3', playerId, 3, 41);

    const started = await start(token);
    now += 120_000;
    const text = started.json.text as string;
    // Fast but human-like typing of the whole text: far above the 40 WPM history.
    const events = [...text].map((key, index) => ({
      t: 20 + index * 40 + ((index * 7) % 13),
      key,
    }));
    const response = await call('POST', '/api/session/submit', {
      token,
      body: {
        sessionId: started.json.sessionId,
        sessionToken: started.json.sessionToken,
        events,
        durationMs: (events[events.length - 1]?.t ?? 0) + 20,
      },
    });
    expect(response.status).toBe(200);
    expect(response.json.verified).toBe(false);
    const row = db.raw.prepare("SELECT flags FROM sessions WHERE id != 'h1' AND wpm > 100").get();
    expect(row).toMatchObject({ flags: expect.stringContaining('wpm_jump') });

    const profile = await call('GET', `/api/profile/${playerId}`);
    expect(profile.json.bestWpm).toBe(42);
    expect(profile.json.sessions).toBe(4);
  });

  it('only verified sessions are visible to the ghost index', () => {
    const plan = db.raw
      .prepare(
        "EXPLAIN QUERY PLAN SELECT id FROM sessions WHERE mode = 'simulator' AND lang = 'en' AND status = 'submitted' AND verified = 1 AND wpm BETWEEN 40 AND 60",
      )
      .all() as { detail: string }[];
    expect(plan.map((row) => row.detail).join(' ')).toContain('idx_sessions_ghost');
  });
});

describe('session token lifecycle', () => {
  it('rejects a token after expiry and after first use', async () => {
    const token = (await createPlayer()).json.deviceToken as string;
    const first = await call('POST', '/api/session/start', { token, body: {} });
    const body = {
      sessionId: first.json.sessionId,
      sessionToken: first.json.sessionToken,
      events: humanEvents(5),
      durationMs: 800,
    };
    now += 5_000;
    expect((await call('POST', '/api/session/submit', { token, body })).status).toBe(200);
    expect((await call('POST', '/api/session/submit', { token, body })).status).toBe(409);

    const second = await call('POST', '/api/session/start', { token, body: {} });
    now += SESSION_TTL_MS + 1;
    const late = await call('POST', '/api/session/submit', {
      token,
      body: { ...body, sessionId: second.json.sessionId, sessionToken: second.json.sessionToken },
    });
    expect(late.status).toBe(410);
    expect(
      db.raw.prepare("SELECT COUNT(*) AS n FROM sessions WHERE status = 'submitted'").get(),
    ).toEqual({ n: 1 });
  });
});
