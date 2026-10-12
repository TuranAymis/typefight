/* eslint-disable @typescript-eslint/no-explicit-any -- test responses are loosely typed JSON */
import { computeResult } from '@typefight/engine';
import { TEXT_POOL } from '@typefight/texts';
import { beforeEach, describe, expect, it } from 'vitest';
import { rhythmFlags } from './antiCheat';
import { BOT_WPM_LEVELS, generateBotRecord, nearestBotLevel } from './bots';
import { createApp } from './index';
import { RATING_WINDOWS } from './matchmaking';
import { createTestDb, type TestDb } from './test/d1';

let db: TestDb;
let now = 5_000_000;
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

const setRating = (playerId: string, rating: number) =>
  db.raw.prepare('UPDATE players SET rating = ? WHERE id = ?').run(rating, playerId);

/** A verified past run on every English text, so a ghost exists whichever text the duel picks. */
const addGhostRuns = (playerId: string, wpm: number, options: { verified?: number } = {}) => {
  const insert = db.raw.prepare(
    `INSERT INTO sessions (id, player_id, mode, lang, text_id, target_text, seed, token_hash, status,
       started_at, submitted_at, wpm, accuracy, verified, record_json)
     VALUES (?, ?, 'simulator', 'en', ?, ?, 1, 'h', 'submitted', 0, 1, ?, 100, ?, ?)`,
  );
  for (const passage of TEXT_POOL.filter((p) => p.lang === 'en')) {
    insert.run(
      `ghost-${playerId}-${passage.id}`,
      playerId,
      passage.id,
      passage.text,
      wpm,
      options.verified ?? 1,
      JSON.stringify(generateBotRecord(passage, 50)),
    );
  }
};

/** Human-like fast typing of the whole text (about 100 WPM, irregular). */
const humanTyping = (text: string, msPerChar = 120) => {
  let t = 200;
  return [...text].map((key, index) => {
    t += Math.round(msPerChar * (0.8 + ((index * 37) % 41) / 100));
    return { t, key };
  });
};

const playDuel = async (token: string, msPerChar: number) => {
  const started = await call('POST', '/api/duel/start', { token, body: { lang: 'en' } });
  expect(started.status).toBe(201);
  now += 120_000;
  const events = humanTyping(started.json.text as string, msPerChar);
  const submitted = await call('POST', '/api/duel/submit', {
    token,
    body: {
      sessionId: started.json.sessionId,
      sessionToken: started.json.sessionToken,
      events,
      durationMs: (events[events.length - 1]?.t ?? 0) + 30,
    },
  });
  return { started, submitted };
};

beforeEach(() => {
  db = createTestDb();
  now = 5_000_000;
});

describe('bot generator', () => {
  it('is deterministic and produces roughly the requested WPM with human-like rhythm', () => {
    const passage = TEXT_POOL.find((p) => p.lang === 'en')!;
    for (const level of BOT_WPM_LEVELS) {
      const record = generateBotRecord(passage, level);
      expect(generateBotRecord(passage, level)).toEqual(record);
      const result = computeResult(record);
      expect(result.wpm).toBeGreaterThan(level * 0.85);
      expect(result.wpm).toBeLessThan(level * 1.15);
      expect(result.accuracy).toBe(100);
      expect(rhythmFlags(record.events, result)).toEqual([]);
    }
  });

  it('maps expected speed to the nearest level', () => {
    expect(nearestBotLevel(10)).toBe(30);
    expect(nearestBotLevel(58)).toBe(50);
    expect(nearestBotLevel(63)).toBe(70);
    expect(nearestBotLevel(400)).toBe(150);
  });
});

describe('POST /api/duel/start', () => {
  it('needs a device token and a valid language', async () => {
    expect((await call('POST', '/api/duel/start', { body: {} })).status).toBe(401);
    const { token } = await createPlayer();
    expect((await call('POST', '/api/duel/start', { token, body: { lang: 'xx' } })).status).toBe(
      400,
    );
  });

  it('falls back to a clearly labelled bot when there is no ghost, and persists it once', async () => {
    const { token } = await createPlayer();
    const first = await call('POST', '/api/duel/start', { token, body: { lang: 'en' } });
    expect(first.status).toBe(201);
    expect(first.json.opponent).toMatchObject({ isBot: true, nickname: '[BOT] 50 WPM' });
    expect(first.json.opponent.record.targetText).toBe(first.json.text);
    expect(first.json.opponent.record.events.length).toBeGreaterThan(10);
    await call('POST', '/api/duel/start', { token, body: { lang: 'en' } });
    const bots = db.raw.prepare('SELECT COUNT(*) AS n FROM players WHERE is_bot = 1').get();
    expect(bots).toEqual({ n: 1 });
  });

  it('prefers a real ghost on the same text with the closest rating', async () => {
    const me = await createPlayer();
    const near = await createPlayer();
    const far = await createPlayer();
    setRating(near.id, 1040);
    setRating(far.id, 1090);
    addGhostRuns(near.id, 60);
    addGhostRuns(far.id, 80);
    const started = await call('POST', '/api/duel/start', {
      token: me.token,
      body: { lang: 'en' },
    });
    expect(started.json.opponent).toMatchObject({ isBot: false, rating: 1040, wpm: 60 });
    expect(started.json.opponent.record.targetText).toBe(started.json.text);
  });

  it('ignores unverified runs, own runs and other languages', async () => {
    const me = await createPlayer();
    const cheater = await createPlayer();
    addGhostRuns(me.id, 60);
    addGhostRuns(cheater.id, 300, { verified: 0 });
    const started = await call('POST', '/api/duel/start', {
      token: me.token,
      body: { lang: 'en' },
    });
    expect(started.json.opponent.isBot).toBe(true);
    const turkish = await call('POST', '/api/duel/start', {
      token: me.token,
      body: { lang: 'tr' },
    });
    expect(turkish.json.opponent.isBot).toBe(true);
  });

  it('widens the rating window step by step but never beyond the last step', async () => {
    const me = await createPlayer();
    const rival = await createPlayer();
    addGhostRuns(rival.id, 70);

    setRating(rival.id, 1000 + RATING_WINDOWS[2]);
    let started = await call('POST', '/api/duel/start', { token: me.token, body: { lang: 'en' } });
    expect(started.json.opponent.isBot).toBe(false);

    setRating(rival.id, 1000 + RATING_WINDOWS[3] + 1);
    started = await call('POST', '/api/duel/start', { token: me.token, body: { lang: 'en' } });
    expect(started.json.opponent.isBot).toBe(true);
  });

  it('skips opponents from the last 10 duels', async () => {
    const me = await createPlayer();
    const rival = await createPlayer();
    addGhostRuns(rival.id, 70);
    db.raw
      .prepare(
        "INSERT INTO duels (id, player_id, opponent_id, winner, created_at) VALUES ('old', ?, ?, 'player', 1)",
      )
      .run(me.id, rival.id);
    const started = await call('POST', '/api/duel/start', {
      token: me.token,
      body: { lang: 'en' },
    });
    expect(started.json.opponent.isBot).toBe(true);
  });
});

describe('POST /api/duel/submit', () => {
  it('beats a slow bot, records the duel and raises the rating; the bot keeps its rating', async () => {
    const me = await createPlayer();
    const { started, submitted } = await playDuel(me.token, 60);
    expect(started.json.opponent.isBot).toBe(true);
    expect(submitted.status).toBe(200);
    expect(submitted.json.verified).toBe(true);
    expect(submitted.json.duel).toMatchObject({
      winner: 'player',
      ratingApplied: true,
      rating: { before: 1000, after: 1000 + submitted.json.duel.rating.delta },
    });
    expect(submitted.json.duel.rating.delta).toBeGreaterThan(0);
    const player = db.raw.prepare('SELECT rating FROM players WHERE id = ?').get(me.id);
    expect(player).toEqual({ rating: submitted.json.duel.rating.after });
    const bot = db.raw.prepare('SELECT rating FROM players WHERE is_bot = 1').get();
    expect(bot).toEqual({ rating: 850 });
    expect(db.raw.prepare('SELECT COUNT(*) AS n FROM duels').get()).toEqual({ n: 1 });
  });

  it('updates both ratings against a real ghost, zero-sum', async () => {
    const me = await createPlayer();
    const rival = await createPlayer();
    addGhostRuns(rival.id, 55);
    const { started, submitted } = await playDuel(me.token, 60);
    expect(started.json.opponent.isBot).toBe(false);
    const { delta } = submitted.json.duel.rating;
    expect(delta).toBe(16);
    expect(db.raw.prepare('SELECT rating FROM players WHERE id = ?').get(rival.id)).toEqual({
      rating: 1000 - delta,
    });
    const row = db.raw.prepare('SELECT * FROM duels').get() as Record<string, number>;
    expect(row['rating_before']).toBe(1000);
    expect(row['rating_after']).toBe(1016);
    expect(row['opponent_rating_after']).toBe(984);
  });

  it('records a loss against a faster ghost and lowers the rating', async () => {
    const me = await createPlayer();
    const { submitted } = await playDuel(me.token, 400);
    expect(submitted.json.duel.winner).toBe('opponent');
    expect(submitted.json.duel.rating.delta).toBeLessThan(0);
  });

  it('does not move ratings for suspicious runs but still records the duel', async () => {
    const me = await createPlayer();
    const started = await call('POST', '/api/duel/start', {
      token: me.token,
      body: { lang: 'en' },
    });
    now += 120_000;
    const robot = [...(started.json.text as string)].map((key, index) => ({
      t: 100 + index * 100,
      key,
    }));
    const submitted = await call('POST', '/api/duel/submit', {
      token: me.token,
      body: {
        sessionId: started.json.sessionId,
        sessionToken: started.json.sessionToken,
        events: robot,
        durationMs: (robot[robot.length - 1]?.t ?? 0) + 30,
      },
    });
    expect(submitted.json.verified).toBe(false);
    expect(submitted.json.duel.ratingApplied).toBe(false);
    expect(submitted.json.duel.rating.delta).toBe(0);
    expect(db.raw.prepare('SELECT rating FROM players WHERE id = ?').get(me.id)).toEqual({
      rating: 1000,
    });
    expect(db.raw.prepare('SELECT COUNT(*) AS n FROM duels').get()).toEqual({ n: 1 });
  });

  it('cannot be replayed and cannot be used with a simulator session', async () => {
    const me = await createPlayer();
    const started = await call('POST', '/api/duel/start', {
      token: me.token,
      body: { lang: 'en' },
    });
    now += 120_000;
    const events = humanTyping(started.json.text as string, 60);
    const body = {
      sessionId: started.json.sessionId,
      sessionToken: started.json.sessionToken,
      events,
      durationMs: (events[events.length - 1]?.t ?? 0) + 30,
    };
    expect((await call('POST', '/api/session/submit', { token: me.token, body })).status).toBe(404);
    expect((await call('POST', '/api/duel/submit', { token: me.token, body })).status).toBe(200);
    expect((await call('POST', '/api/duel/submit', { token: me.token, body })).status).toBe(409);
    expect(db.raw.prepare('SELECT COUNT(*) AS n FROM duels').get()).toEqual({ n: 1 });
  });

  it('shows the duel summary on the profile', async () => {
    const me = await createPlayer();
    await playDuel(me.token, 60);
    const profile = await call('GET', `/api/profile/${me.id}`);
    expect(profile.json.duels).toMatchObject({ played: 1, won: 1 });
    expect(profile.json.rating).toBeGreaterThan(1000);
  });
});

describe('rematch', () => {
  it('replays the same opponent run on the same text', async () => {
    const me = await createPlayer();
    const rival = await createPlayer();
    addGhostRuns(rival.id, 55);
    const first = await call('POST', '/api/duel/start', { token: me.token, body: { lang: 'en' } });
    const ghostId = `ghost-${rival.id}-${first.json.textId}`;
    const again = await call('POST', '/api/duel/start', {
      token: me.token,
      body: { lang: 'en', rematchSessionId: ghostId },
    });
    expect(again.status).toBe(201);
    expect(again.json.text).toBe(first.json.text);
    expect(again.json.opponent).toMatchObject({ isBot: false, wpm: 55 });
  });

  it('works against a bot and rejects unknown, own, unverified or malformed targets', async () => {
    const me = await createPlayer();
    const first = await call('POST', '/api/duel/start', { token: me.token, body: { lang: 'en' } });
    const botSession = `bot-50-${first.json.textId}`;
    const again = await call('POST', '/api/duel/start', {
      token: me.token,
      body: { lang: 'en', rematchSessionId: botSession },
    });
    expect(again.status).toBe(201);
    expect(again.json.opponent.isBot).toBe(true);
    expect(again.json.text).toBe(first.json.text);

    const cheater = await createPlayer();
    addGhostRuns(cheater.id, 300, { verified: 0 });
    addGhostRuns(me.id, 60);
    const target = (id: string) => `ghost-${id}-en-001`;
    for (const rematchSessionId of ['nope', target(cheater.id), target(me.id)]) {
      const response = await call('POST', '/api/duel/start', {
        token: me.token,
        body: { lang: 'en', rematchSessionId },
      });
      expect(response.status).toBe(404);
    }
    const malformed = await call('POST', '/api/duel/start', {
      token: me.token,
      body: { lang: 'en', rematchSessionId: 5 },
    });
    expect(malformed.status).toBe(400);
  });
});
