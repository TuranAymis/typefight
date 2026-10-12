import type { Context } from 'hono';
import { sha256Hex } from './crypto';
import type { AppContext, PlayerRow } from './types';

export const bearerToken = (context: Context<AppContext>): string | undefined => {
  const header = context.req.header('Authorization') ?? '';
  const match = /^Bearer ([0-9a-f]{64})$/.exec(header);
  return match?.[1];
};

/** Resolves the player behind the device token, or undefined when missing/unknown. */
export const findPlayerByToken = async (
  context: Context<AppContext>,
): Promise<PlayerRow | undefined> => {
  const token = bearerToken(context);
  if (!token) return undefined;
  const row = await context.env.DB.prepare(
    'SELECT * FROM players WHERE token_hash = ? AND is_bot = 0',
  )
    .bind(await sha256Hex(token))
    .first<PlayerRow>();
  return row ?? undefined;
};
