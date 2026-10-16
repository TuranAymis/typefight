import type { PlayerIdentity } from '../identity/playerApi';
import { apiUrl } from '../apiBase';
import { resolveCursorEffect } from './cursorEffects';

export interface Profile {
  readonly cursorEffect: string;
  readonly playerId: string;
  readonly nickname: string;
  readonly rating: number;
  readonly sessions: number;
  readonly bestWpm: number;
  readonly averageAccuracy: number;
  readonly badges: readonly { readonly id: string; readonly earnedAt: number }[];
  readonly duels: {
    readonly played: number;
    readonly won: number;
    readonly lost: number;
    readonly drawn: number;
  };
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
type Failure = { readonly ok: false; readonly error: 'network' | 'server' };

const defaultFetch: FetchLike = (input, init) => fetch(input, init);

const readJson = async (response: Response): Promise<Record<string, unknown> | null> =>
  (await response.json().catch(() => null)) as Record<string, unknown> | null;

const isProfile = (
  body: Record<string, unknown> | null,
): body is Record<string, unknown> & Profile =>
  body !== null &&
  typeof body['playerId'] === 'string' &&
  typeof body['nickname'] === 'string' &&
  typeof body['rating'] === 'number' &&
  typeof body['bestWpm'] === 'number' &&
  typeof body['averageAccuracy'] === 'number' &&
  typeof body['duels'] === 'object' &&
  body['duels'] !== null &&
  Array.isArray(body['badges']) &&
  body['badges'].every(
    (badge: unknown) =>
      typeof badge === 'object' && badge !== null && 'id' in badge && typeof badge.id === 'string',
  );

export const fetchProfile = async (
  playerId: string,
  fetchFn: FetchLike = defaultFetch,
): Promise<{ readonly ok: true; readonly profile: Profile } | Failure> => {
  try {
    const response = await fetchFn(apiUrl(`/api/profile/${encodeURIComponent(playerId)}`));
    const body = await readJson(response);
    return response.ok && isProfile(body)
      ? {
          ok: true,
          profile: {
            ...body,
            cursorEffect: resolveCursorEffect(body['cursorEffect'], body.badges),
          },
        }
      : { ok: false, error: 'server' };
  } catch {
    return { ok: false, error: 'network' };
  }
};

export const setCursorEffect = async (
  deviceToken: string,
  effectId: string,
  fetchFn: FetchLike = defaultFetch,
): Promise<{ readonly ok: true; readonly effectId: string } | Failure> => {
  try {
    const response = await fetchFn(apiUrl('/api/player/cursor-effect'), {
      method: 'PUT',
      headers: { Authorization: `Bearer ${deviceToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ effectId }),
    });
    const body = await readJson(response);
    return response.ok && body?.['effectId'] === effectId
      ? { ok: true, effectId }
      : { ok: false, error: 'server' };
  } catch {
    return { ok: false, error: 'network' };
  }
};

/** Asks the server for a new recovery code. Shown to the player once; the server keeps only a hash. */
export const createRecoveryCode = async (
  deviceToken: string,
  fetchFn: FetchLike = defaultFetch,
): Promise<{ readonly ok: true; readonly code: string } | Failure> => {
  try {
    const response = await fetchFn(apiUrl('/api/player/recovery-code'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${deviceToken}` },
    });
    const body = await readJson(response);
    return response.ok && typeof body?.['recoveryCode'] === 'string'
      ? { ok: true, code: body['recoveryCode'] }
      : { ok: false, error: 'server' };
  } catch {
    return { ok: false, error: 'network' };
  }
};

export type RecoverResult =
  | { readonly ok: true; readonly identity: PlayerIdentity }
  | { readonly ok: false; readonly error: 'invalid_code' | 'rate_limited' | 'network' | 'server' };

/** Trades a recovery code for a fresh device token (the old one stops working). */
export const recoverProfile = async (
  code: string,
  fetchFn: FetchLike = defaultFetch,
): Promise<RecoverResult> => {
  let response: Response;
  try {
    response = await fetchFn(apiUrl('/api/player/recover'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
  } catch {
    return { ok: false, error: 'network' };
  }
  const body = await readJson(response);
  if (response.status === 400 || response.status === 404)
    return { ok: false, error: 'invalid_code' };
  if (response.status === 429) return { ok: false, error: 'rate_limited' };
  if (
    response.ok &&
    typeof body?.['playerId'] === 'string' &&
    typeof body['nickname'] === 'string' &&
    typeof body['deviceToken'] === 'string'
  ) {
    return {
      ok: true,
      identity: {
        playerId: body['playerId'],
        nickname: body['nickname'],
        deviceToken: body['deviceToken'],
      },
    };
  }
  return { ok: false, error: 'server' };
};

export const winRate = (duels: Profile['duels']): number =>
  duels.played === 0 ? 0 : Math.round((duels.won / duels.played) * 100);
