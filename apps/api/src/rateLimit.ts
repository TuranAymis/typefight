import type { Context } from 'hono';
import { sha256Hex } from './crypto';
import type { AppContext } from './types';

export const START_WINDOW_MS = 10 * 60 * 1000;
export const MAX_STARTS_PER_PLAYER = 20;
export const MAX_STARTS_PER_IP = 60;
export const PLAYER_WINDOW_MS = 60 * 60 * 1000;
export const MAX_NEW_PLAYERS_PER_IP = 10;

/** Hash of the caller IP (Cloudflare header), or null when unknown (local dev). Raw IPs are never stored. */
export const clientIpHash = async (context: Context<AppContext>): Promise<string | null> => {
  const ip = context.req.header('CF-Connecting-IP');
  return ip ? sha256Hex(`ip:${ip}`) : null;
};

const count = async (
  db: D1Database,
  sql: string,
  ...values: (string | number)[]
): Promise<number> => {
  const row = await db
    .prepare(sql)
    .bind(...values)
    .first<{ total: number }>();
  return row?.total ?? 0;
};

export const tooManySessionStarts = async (
  db: D1Database,
  now: number,
  playerId: string,
  ipHash: string | null,
): Promise<boolean> => {
  const since = now - START_WINDOW_MS;
  const forPlayer = await count(
    db,
    'SELECT COUNT(*) AS total FROM sessions WHERE player_id = ? AND started_at > ?',
    playerId,
    since,
  );
  if (forPlayer >= MAX_STARTS_PER_PLAYER) return true;
  if (!ipHash) return false;
  const forIp = await count(
    db,
    'SELECT COUNT(*) AS total FROM sessions WHERE ip_hash = ? AND started_at > ?',
    ipHash,
    since,
  );
  return forIp >= MAX_STARTS_PER_IP;
};

export const tooManyNewPlayers = async (
  db: D1Database,
  now: number,
  ipHash: string | null,
): Promise<boolean> => {
  if (!ipHash) return false;
  const created = await count(
    db,
    'SELECT COUNT(*) AS total FROM players WHERE ip_hash = ? AND created_at > ?',
    ipHash,
    now - PLAYER_WINDOW_MS,
  );
  return created >= MAX_NEW_PLAYERS_PER_IP;
};

export const RECOVERY_WINDOW_MS = 10 * 60 * 1000;
export const MAX_RECOVERY_ATTEMPTS_PER_IP = 10;

export const tooManyRecoveryAttempts = async (
  db: D1Database,
  now: number,
  ipHash: string | null,
): Promise<boolean> => {
  if (!ipHash) return false;
  const attempts = await count(
    db,
    'SELECT COUNT(*) AS total FROM recovery_attempts WHERE ip_hash = ? AND attempted_at > ?',
    ipHash,
    now - RECOVERY_WINDOW_MS,
  );
  return attempts >= MAX_RECOVERY_ATTEMPTS_PER_IP;
};

export const recordRecoveryAttempt = async (
  db: D1Database,
  now: number,
  ipHash: string | null,
): Promise<void> => {
  if (!ipHash) return;
  await db
    .prepare('INSERT INTO recovery_attempts (ip_hash, attempted_at) VALUES (?, ?)')
    .bind(ipHash, now)
    .run();
};
