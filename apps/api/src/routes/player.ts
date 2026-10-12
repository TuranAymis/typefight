import { Hono } from 'hono';
import { validateNickname } from '@typefight/texts';
import { findPlayerByToken } from '../auth';
import {
  normalizeRecoveryCode,
  randomId,
  randomRecoveryCode,
  randomToken,
  sha256Hex,
} from '../crypto';
import {
  clientIpHash,
  recordRecoveryAttempt,
  tooManyNewPlayers,
  tooManyRecoveryAttempts,
} from '../rateLimit';
import type { AppContext } from '../types';

export const player = new Hono<AppContext>();

const generatedNickname = (): string => `Typist-${randomToken().slice(0, 4)}`;

/**
 * POST /api/player
 * - With a valid device token: returns the existing player (the browser is recognised again).
 * - Without one: creates an anonymous player and returns a new device token ONCE; only its hash is stored.
 */
player.post('/', async (context) => {
  const existing = await findPlayerByToken(context);
  if (existing) {
    return context.json({
      created: false,
      playerId: existing.id,
      nickname: existing.nickname,
    });
  }

  const body = (await context.req.json().catch(() => ({}))) as { nickname?: unknown };
  let nickname = generatedNickname();
  if (body.nickname !== undefined) {
    if (typeof body.nickname !== 'string') {
      return context.json({ error: 'invalid_nickname', reason: 'invalid_chars' }, 400);
    }
    const check = validateNickname(body.nickname);
    if (!check.ok) return context.json({ error: 'invalid_nickname', reason: check.error }, 400);
    nickname = check.nickname;
  }

  const ipHash = await clientIpHash(context);
  const now = context.get('now')();
  if (await tooManyNewPlayers(context.env.DB, now, ipHash)) {
    return context.json({ error: 'rate_limited' }, 429, { 'Retry-After': '3600' });
  }

  const id = randomId();
  const deviceToken = randomToken();
  await context.env.DB.prepare(
    'INSERT INTO players (id, nickname, token_hash, created_at, ip_hash) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(id, nickname, await sha256Hex(deviceToken), now, ipHash)
    .run();
  return context.json({ created: true, playerId: id, nickname, deviceToken }, 201);
});

/** PATCH /api/player/nickname: lets the recognised player change the display name. */
player.patch('/nickname', async (context) => {
  const current = await findPlayerByToken(context);
  if (!current) return context.json({ error: 'unauthorized' }, 401);
  const body = (await context.req.json().catch(() => ({}))) as { nickname?: unknown };
  const check = validateNickname(typeof body.nickname === 'string' ? body.nickname : '');
  if (!check.ok) return context.json({ error: 'invalid_nickname', reason: check.error }, 400);
  await context.env.DB.prepare('UPDATE players SET nickname = ? WHERE id = ?')
    .bind(check.nickname, current.id)
    .run();
  return context.json({ playerId: current.id, nickname: check.nickname });
});

/**
 * POST /api/player/recovery-code: creates a new recovery code (replacing any older one). The code is
 * returned once; only its hash is stored. Used to move the profile to another browser or device.
 */
player.post('/recovery-code', async (context) => {
  const current = await findPlayerByToken(context);
  if (!current) return context.json({ error: 'unauthorized' }, 401);
  const code = randomRecoveryCode();
  await context.env.DB.prepare('UPDATE players SET recovery_hash = ? WHERE id = ?')
    .bind(await sha256Hex(normalizeRecoveryCode(code)), current.id)
    .run();
  return context.json({ recoveryCode: code });
});

/**
 * POST /api/player/recover { code }: swaps a valid recovery code for a fresh device token. The old
 * device token stops working and the code is consumed, so a leaked old code cannot be reused.
 */
player.post('/recover', async (context) => {
  const body = (await context.req.json().catch(() => ({}))) as { code?: unknown };
  const code = typeof body.code === 'string' ? normalizeRecoveryCode(body.code) : '';
  const ipHash = await clientIpHash(context);
  const now = context.get('now')();
  if (await tooManyRecoveryAttempts(context.env.DB, now, ipHash)) {
    return context.json({ error: 'rate_limited' }, 429, { 'Retry-After': '600' });
  }
  await recordRecoveryAttempt(context.env.DB, now, ipHash);
  if (code.length !== 20) return context.json({ error: 'invalid_code' }, 400);

  const found = await context.env.DB.prepare(
    'SELECT id, nickname FROM players WHERE recovery_hash = ? AND is_bot = 0',
  )
    .bind(await sha256Hex(code))
    .first<{ id: string; nickname: string }>();
  if (!found) return context.json({ error: 'invalid_code' }, 404);

  const deviceToken = randomToken();
  await context.env.DB.prepare(
    'UPDATE players SET token_hash = ?, recovery_hash = NULL WHERE id = ? AND recovery_hash = ?',
  )
    .bind(await sha256Hex(deviceToken), found.id, await sha256Hex(code))
    .run();
  return context.json({ playerId: found.id, nickname: found.nickname, deviceToken });
});
