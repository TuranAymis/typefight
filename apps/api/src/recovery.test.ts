import { beforeEach, describe, expect, it } from 'vitest';
import { MAX_RECOVERY_ATTEMPTS_PER_IP } from './rateLimit';
import { createApp } from './index';
import { createTestDb, type TestDb } from './test/d1';

let db: TestDb;
const app = createApp(() => 1_000_000);

const call = async (
  path: string,
  options: { token?: string; body?: unknown; ip?: string; method?: string } = {},
) => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.ip) headers['CF-Connecting-IP'] = options.ip;
  const response = await app.request(
    path,
    { method: options.method ?? 'POST', headers, body: JSON.stringify(options.body ?? {}) },
    { DB: db.d1 },
  );
  return { status: response.status, json: (await response.json()) as Record<string, string> };
};

const newPlayer = async () => {
  const created = await call('/api/player', { body: { nickname: 'Recover_Me' } });
  return { token: created.json.deviceToken as string, id: created.json.playerId as string };
};

beforeEach(() => {
  db = createTestDb();
});

describe('recovery code', () => {
  it('needs a device token to create a code and stores only its hash', async () => {
    expect((await call('/api/player/recovery-code')).status).toBe(401);
    const me = await newPlayer();
    const created = await call('/api/player/recovery-code', { token: me.token });
    expect(created.status).toBe(200);
    expect(created.json.recoveryCode).toMatch(/^([2-9A-HJKMNP-Z]{5}-){3}[2-9A-HJKMNP-Z]{5}$/);
    const row = db.raw.prepare('SELECT recovery_hash FROM players WHERE id = ?').get(me.id) as {
      recovery_hash: string;
    };
    expect(row.recovery_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(row)).not.toContain(created.json.recoveryCode);
  });

  it('swaps the code for a new device token, kills the old token and consumes the code', async () => {
    const me = await newPlayer();
    const { json } = await call('/api/player/recovery-code', { token: me.token });
    const code = json.recoveryCode as string;

    // Lower case and missing dashes still work.
    const recovered = await call('/api/player/recover', {
      body: { code: code.toLowerCase().replaceAll('-', ' ') },
    });
    expect(recovered.status).toBe(200);
    expect(recovered.json).toMatchObject({ playerId: me.id, nickname: 'Recover_Me' });
    expect(recovered.json.deviceToken).toMatch(/^[0-9a-f]{64}$/);
    expect(recovered.json.deviceToken).not.toBe(me.token);

    expect((await call('/api/player', { token: me.token })).json.created).toBe(true);
    const again = await call('/api/player', { token: recovered.json.deviceToken as string });
    expect(again.json).toMatchObject({ created: false, playerId: me.id });
    expect((await call('/api/player/recover', { body: { code } })).status).toBe(404);
  });

  it('a new code replaces the previous one', async () => {
    const me = await newPlayer();
    const first = (await call('/api/player/recovery-code', { token: me.token })).json
      .recoveryCode as string;
    const second = (await call('/api/player/recovery-code', { token: me.token })).json
      .recoveryCode as string;
    expect((await call('/api/player/recover', { body: { code: first } })).status).toBe(404);
    expect((await call('/api/player/recover', { body: { code: second } })).status).toBe(200);
  });

  it('rejects malformed codes and rate limits guessing per IP', async () => {
    expect((await call('/api/player/recover', { body: { code: 'short' } })).status).toBe(400);
    expect((await call('/api/player/recover', { body: {} })).status).toBe(400);
    for (let i = 0; i < MAX_RECOVERY_ATTEMPTS_PER_IP; i += 1) {
      await call('/api/player/recover', { ip: '9.9.9.9', body: { code: 'x' } });
    }
    const blocked = await call('/api/player/recover', { ip: '9.9.9.9', body: { code: 'x' } });
    expect(blocked.status).toBe(429);
  });
});
