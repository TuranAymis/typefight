import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CURSOR_EFFECTS } from '@typefight/texts';
import { createApp } from './index';
import { createTestDb, type TestDb } from './test/d1';

let db: TestDb;
let now = 1_000_000;
const app = createApp(() => now);
let token: string;
let playerId: string;

const select = (body: unknown, auth: string | null = token) =>
  app.request(
    '/api/player/cursor-effect',
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
      },
      body: JSON.stringify(body),
    },
    { DB: db.d1 },
  );
const profile = async () =>
  (await app.request(`/api/profile/${playerId}`, {}, { DB: db.d1 })).json();

beforeEach(async () => {
  db = createTestDb();
  now = 1_000_000;
  const response = await app.request(
    '/api/player',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: 'Ada' }),
    },
    { DB: db.d1 },
  );
  const body = (await response.json()) as { deviceToken: string; playerId: string };
  token = body.deviceToken;
  playerId = body.playerId;
});
afterEach(() => db.raw.close());

describe('cursor effects', () => {
  it('defaults old/null profiles and persists each earned effect and a reset', async () => {
    expect(await profile()).toMatchObject({ cursorEffect: 'default' });
    db.raw.prepare('UPDATE players SET cursor_effect = NULL WHERE id = ?').run(playerId);
    expect(await profile()).toMatchObject({ cursorEffect: 'default' });
    for (const effect of CURSOR_EFFECTS.filter(({ unlockBadgeId }) => unlockBadgeId)) {
      db.raw
        .prepare('INSERT INTO badges (player_id, badge_id, earned_at) VALUES (?, ?, ?)')
        .run(playerId, effect.unlockBadgeId, now);
      const response = await select({ effectId: effect.id });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ effectId: effect.id });
      expect(await profile()).toMatchObject({ cursorEffect: effect.id });
    }
    expect((await select({ effectId: 'default' })).status).toBe(200);
    expect(await profile()).toMatchObject({ cursorEffect: 'default' });
  });

  it.each([{ effectId: 'missing' }, { effectId: 42 }, {}, null, []])(
    'rejects an invalid body: %j',
    async (body) => {
      expect((await select(body)).status).toBe(400);
      expect(await profile()).toMatchObject({ cursorEffect: 'default' });
    },
  );

  it('rejects locked effects even when another player owns the badge', async () => {
    db.raw
      .prepare('INSERT INTO players (id, nickname, token_hash, created_at) VALUES (?, ?, ?, ?)')
      .run('other', 'Other', 'other-token-hash', now);
    db.raw
      .prepare('INSERT INTO badges (player_id, badge_id, earned_at) VALUES (?, ?, ?)')
      .run('other', 'first-win', now);
    for (const effect of CURSOR_EFFECTS.filter(({ unlockBadgeId }) => unlockBadgeId)) {
      expect((await select({ effectId: effect.id })).status).toBe(403);
    }
    expect(await profile()).toMatchObject({ cursorEffect: 'default' });
  });

  it('requires a valid device token', async () => {
    expect((await select({ effectId: 'default' }, null)).status).toBe(401);
    expect((await select({ effectId: 'default' }, 'b'.repeat(64))).status).toBe(401);
  });

  it('limits writes per player and permits writes after the window', async () => {
    for (let index = 0; index < 20; index += 1)
      expect((await select({ effectId: 'default' })).status).toBe(200);
    const limited = await select({ effectId: 'default' });
    expect(limited.status).toBe(429);
    expect(limited.headers.get('Retry-After')).toBe('600');
    now += 600_000;
    expect((await select({ effectId: 'default' })).status).toBe(200);
  });
});
