import type { NicknameError } from '@typefight/texts';
import { apiUrl } from '../apiBase';

export interface PlayerIdentity {
  readonly playerId: string;
  readonly nickname: string;
  readonly deviceToken: string;
}

export type RegisterResult =
  | { readonly ok: true; readonly identity: PlayerIdentity }
  | { readonly ok: false; readonly error: NicknameError | 'network' | 'server' };

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const NICKNAME_ERRORS: readonly string[] = ['too_short', 'too_long', 'invalid_chars', 'profanity'];

/** Creates the anonymous player on the server. The device token is returned once, so the caller must persist it. */
export const registerPlayer = async (
  nickname: string,
  fetchFn: FetchLike = (input, init) => fetch(input, init),
): Promise<RegisterResult> => {
  let response: Response;
  try {
    response = await fetchFn(apiUrl('/api/player'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname }),
    });
  } catch {
    return { ok: false, error: 'network' };
  }

  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (response.status === 400 && body?.['error'] === 'invalid_nickname') {
    const reason = String(body['reason']);
    if (NICKNAME_ERRORS.includes(reason)) {
      return { ok: false, error: reason as NicknameError };
    }
  }
  if (
    response.status === 201 &&
    body &&
    typeof body['playerId'] === 'string' &&
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
