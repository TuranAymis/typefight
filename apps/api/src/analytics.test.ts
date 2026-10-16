import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './index';
import type { Metrics } from './metrics';
import { MAX_EVENTS_PER_CLIENT_HOUR, utcDay } from './routes/events';
import { createTestDb, type TestDb } from './test/d1';

const NOW = Date.UTC(2026, 9, 16, 12, 0, 0); // 2026-10-16
const SECRET = 'metrics-secret-123';
const CLIENT = 'a'.repeat(32);

let db: TestDb;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  db = createTestDb();
  app = createApp(() => NOW);
});

const post = async (body: unknown, raw?: string) => {
  const response = await app.request(
    '/api/events',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.9' },
      body: raw ?? JSON.stringify(body),
    },
    { DB: db.d1 },
  );
  return { status: response.status, json: (await response.json()) as Record<string, unknown> };
};

const rows = () =>
  db.raw.prepare('SELECT * FROM analytics_events ORDER BY id').all() as {
    client_id: string;
    name: string;
    day: string;
    created_at: number;
    props: string;
  }[];

describe('POST /api/events', () => {
  it('stores a valid batch stamped with the server clock', async () => {
    const result = await post({
      clientId: CLIENT,
      events: [{ name: 'game_open' }, { name: 'sim_started', props: { lang: 'tr' } }],
    });
    expect(result.status).toBe(202);
    expect(result.json).toEqual({ accepted: 2 });
    expect(rows()).toEqual([
      expect.objectContaining({
        client_id: CLIENT,
        name: 'game_open',
        day: '2026-10-16',
        created_at: NOW,
        props: '{}',
      }),
      expect.objectContaining({ name: 'sim_started', props: '{"lang":"tr"}' }),
    ]);
  });

  it('ignores any timestamp the client sends', async () => {
    await post({ clientId: CLIENT, events: [{ name: 'game_open', t: 1, day: '1999-01-01' }] });
    expect(rows()[0]).toMatchObject({ day: '2026-10-16', created_at: NOW });
  });

  it('keeps no personal data: no IP, nickname or free text reaches the table', async () => {
    await post({ clientId: CLIENT, events: [{ name: 'game_open' }] });
    const columns = Object.keys(rows()[0] ?? {}).sort();
    expect(columns).toEqual(['client_id', 'created_at', 'day', 'id', 'name', 'props']);
    expect(JSON.stringify(rows())).not.toContain('203.0.113.9');
  });

  it('rejects the whole batch when any event is outside the schema', async () => {
    const bad: unknown[] = [
      { name: 'page_view' },
      { name: 'game_open', props: { nickname: 'Ada' } },
      { name: 'sim_started' },
      { name: 'sim_started', props: { lang: 'de' } },
      { name: 'duel_completed', props: { lang: 'en', winner: 'player' } },
      'game_open',
      null,
    ];
    for (const event of bad) {
      const result = await post({ clientId: CLIENT, events: [{ name: 'game_open' }, event] });
      expect(result.status).toBe(400);
      expect(result.json).toEqual({ error: 'invalid_events' });
    }
    expect(rows()).toHaveLength(0);
  });

  it('rejects bad client ids and malformed bodies', async () => {
    for (const clientId of ['', 'short', 'A'.repeat(32), 'z'.repeat(32), 5, undefined]) {
      expect((await post({ clientId, events: [{ name: 'game_open' }] })).status).toBe(400);
    }
    expect((await post({ clientId: CLIENT })).status).toBe(400);
    expect((await post({ clientId: CLIENT, events: [] })).status).toBe(400);
    expect((await post({ clientId: CLIENT, events: 'game_open' })).status).toBe(400);
    expect((await post(null, 'not json')).status).toBe(400);
    expect((await post([])).status).toBe(400);
  });

  it('accepts at most 20 events per request and a small body', async () => {
    const twenty = Array.from({ length: 20 }, () => ({ name: 'game_open' }));
    expect((await post({ clientId: CLIENT, events: twenty })).status).toBe(202);
    expect(
      (await post({ clientId: CLIENT, events: [...twenty, { name: 'game_open' }] })).status,
    ).toBe(400);
    const huge = { clientId: CLIENT, events: [{ name: 'game_open' }], padding: 'x'.repeat(5000) };
    expect((await post(huge)).status).toBe(413);
  });

  it('rate limits one device per hour but not another device', async () => {
    const batch = Array.from({ length: 20 }, () => ({ name: 'game_open' }));
    for (let sent = 0; sent < MAX_EVENTS_PER_CLIENT_HOUR; sent += 20) {
      expect((await post({ clientId: CLIENT, events: batch })).status).toBe(202);
    }
    const over = await post({ clientId: CLIENT, events: [{ name: 'game_open' }] });
    expect(over.status).toBe(429);
    expect((await post({ clientId: 'b'.repeat(32), events: [{ name: 'game_open' }] })).status).toBe(
      202,
    );
  });

  it('lets a device write again once an hour has passed', async () => {
    const insert = db.raw.prepare(
      "INSERT INTO analytics_events (client_id, name, day, created_at) VALUES (?, 'game_open', '2026-10-16', ?)",
    );
    for (let i = 0; i < MAX_EVENTS_PER_CLIENT_HOUR; i++) insert.run(CLIENT, NOW - 3_700_000);
    expect((await post({ clientId: CLIENT, events: [{ name: 'game_open' }] })).status).toBe(202);
  });
});

const seed = (client: string, name: string, day: string, props = '{}') =>
  db.raw
    .prepare(
      'INSERT INTO analytics_events (client_id, name, day, created_at, props) VALUES (?, ?, ?, 0, ?)',
    )
    .run(client, name, day, props);

const metrics = async (
  options: { token?: string | null; days?: string; secret?: string | null } = {},
) => {
  const headers: Record<string, string> = {};
  if (options.token !== null) headers.Authorization = `Bearer ${options.token ?? SECRET}`;
  const env: { DB: D1Database; METRICS_TOKEN?: string } = { DB: db.d1 };
  if (options.secret !== null) env.METRICS_TOKEN = options.secret ?? SECRET;
  const response = await app.request(
    `/api/admin/metrics${options.days ? `?days=${options.days}` : ''}`,
    { headers },
    env,
  );
  return { status: response.status, json: (await response.json()) as Metrics };
};

describe('GET /api/admin/metrics', () => {
  it('does not exist unless a secret is configured', async () => {
    expect((await metrics({ secret: null })).status).toBe(404);
  });

  it('needs the secret as a bearer token', async () => {
    expect((await metrics({ token: null })).status).toBe(401);
    expect((await metrics({ token: 'wrong' })).status).toBe(401);
    expect((await metrics({ token: SECRET + 'x' })).status).toBe(401);
    expect((await metrics()).status).toBe(200);
  });

  it('reports nulls instead of dividing by zero on an empty database', async () => {
    const { json } = await metrics();
    expect(json.activeClients).toBe(0);
    expect(json.retention.d1).toEqual({ eligible: 0, retained: 0, rate: null });
    expect(json.retention.d7).toEqual({ eligible: 0, retained: 0, rate: null });
    expect(json.duels).toEqual({
      completed: 0,
      players: 0,
      perPlayer: null,
      rematches: 0,
      rematchRate: null,
    });
    expect(json.daily).toEqual([]);
    expect(json.counts.game_open).toBe(0);
  });

  describe('with a known event history', () => {
    beforeEach(() => {
      // Today is 2026-10-16. Day names below are UTC dates.
      // A: first visit 10-01, back on 10-02 (D1) and 10-08 (D7).
      for (const day of ['2026-10-01', '2026-10-02', '2026-10-08']) seed('a', 'game_open', day);
      // B: first visit 10-01, never returns.
      seed('b', 'game_open', '2026-10-01');
      // C: first visit 10-01, returns on 10-03 only (day 2: neither D1 nor D7).
      for (const day of ['2026-10-01', '2026-10-03']) seed('c', 'game_open', day);
      // E: first visit 10-12 (too recent for D7), back on 10-13.
      for (const day of ['2026-10-12', '2026-10-13']) seed('e', 'game_open', day);
      // F: first visit today: too recent for both.
      seed('f', 'game_open', '2026-10-16');
      // Duels: A completes 3 and rematches once, B completes 1.
      for (let i = 0; i < 3; i++) seed('a', 'duel_completed', '2026-10-02', '{"lang":"en"}');
      seed('b', 'duel_completed', '2026-10-01');
      seed('a', 'rematch', '2026-10-02');
      seed('a', 'glitch_fired', '2026-10-02');
    });

    it('computes D1 and D7 retention only over cohorts old enough', async () => {
      const { json } = await metrics();
      // D1 eligible: first visit <= 10-15 -> A, B, C, E. Retained: A, E.
      expect(json.retention.d1).toEqual({ eligible: 4, retained: 2, rate: 0.5 });
      // D7 eligible: first visit <= 10-09 -> A, B, C. Retained: A.
      expect(json.retention.d7).toEqual({ eligible: 3, retained: 1, rate: 0.333 });
    });

    it('computes duels per player and rematch rate', async () => {
      const { json } = await metrics();
      expect(json.duels).toEqual({
        completed: 4,
        players: 2,
        perPlayer: 2,
        rematches: 1,
        rematchRate: 0.25,
      });
    });

    it('counts every event and the active clients in the window', async () => {
      const { json } = await metrics();
      expect(json.counts).toMatchObject({
        game_open: 9,
        duel_completed: 4,
        rematch: 1,
        glitch_fired: 1,
        sim_started: 0,
      });
      expect(json.activeClients).toBe(5);
      expect(json.window).toEqual({ days: 30, from: '2026-09-17', to: '2026-10-16' });
    });

    it('lists the days in order with distinct openers and duels', async () => {
      const { json } = await metrics();
      expect(json.daily[0]).toEqual({ day: '2026-10-01', opens: 3, duelsCompleted: 1 });
      expect(json.daily.map((d: { day: string }) => d.day)).toEqual(
        [...json.daily.map((d: { day: string }) => d.day)].sort(),
      );
      expect(json.daily.at(-1)).toEqual({ day: '2026-10-16', opens: 1, duelsCompleted: 0 });
    });

    it('narrows to the requested number of days and clamps silly values', async () => {
      const narrow = await metrics({ days: '3' });
      expect(narrow.json.window).toEqual({ days: 3, from: '2026-10-14', to: '2026-10-16' });
      expect(narrow.json.activeClients).toBe(1);
      expect((await metrics({ days: '9999' })).json.window.days).toBe(90);
      expect((await metrics({ days: '0' })).json.window.days).toBe(1);
      expect((await metrics({ days: 'abc' })).json.window.days).toBe(30);
    });
  });
});

describe('utcDay', () => {
  it('uses the UTC date, not the local one', () => {
    expect(utcDay(Date.UTC(2026, 0, 1, 23, 59, 59))).toBe('2026-01-01');
    expect(utcDay(Date.UTC(2026, 0, 2, 0, 0, 0))).toBe('2026-01-02');
  });
});
