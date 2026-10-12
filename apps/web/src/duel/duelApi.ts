import type { KeyEvent, SessionRecord } from '@typefight/engine';

export interface DuelOpponent {
  readonly sessionId: string;
  readonly nickname: string;
  readonly rating: number;
  readonly isBot: boolean;
  readonly wpm: number;
  readonly record: SessionRecord;
}

export interface DuelStart {
  readonly sessionId: string;
  readonly sessionToken: string;
  readonly lang: 'en' | 'tr';
  readonly text: string;
  readonly opponent: DuelOpponent;
}

export interface DuelOutcome {
  readonly verified: boolean;
  readonly newBadges?: readonly { readonly id: string; readonly name: string }[];
  readonly result: { readonly wpm: number; readonly accuracy: number };
  readonly duel: {
    readonly winner: 'player' | 'opponent' | 'draw';
    readonly reason: 'ko' | 'hp' | 'wpm' | 'accuracy' | 'draw';
    readonly hp: { readonly a: number; readonly b: number };
    readonly endedAt: number;
    readonly rating: { readonly before: number; readonly after: number; readonly delta: number };
    readonly ratingApplied: boolean;
  };
}

export type DuelApiError = 'unauthorized' | 'rate_limited' | 'not_found' | 'network' | 'server';
type Failure = { readonly ok: false; readonly error: DuelApiError };
type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const defaultFetch: FetchLike = (input, init) => fetch(input, init);

const post = async (
  path: string,
  deviceToken: string,
  payload: unknown,
  fetchFn: FetchLike,
): Promise<{ status: number; body: Record<string, unknown> | null } | 'network'> => {
  try {
    const response = await fetchFn(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${deviceToken}` },
      body: JSON.stringify(payload),
    });
    return {
      status: response.status,
      body: (await response.json().catch(() => null)) as Record<string, unknown> | null,
    };
  } catch {
    return 'network';
  }
};

const failureFor = (status: number): Failure => ({
  ok: false,
  error:
    status === 401
      ? 'unauthorized'
      : status === 429
        ? 'rate_limited'
        : status === 404
          ? 'not_found'
          : 'server',
});

const isOpponent = (value: unknown): value is DuelOpponent => {
  if (typeof value !== 'object' || value === null) return false;
  const o = value as Record<string, unknown>;
  const record = o['record'] as Record<string, unknown> | undefined;
  return (
    typeof o['sessionId'] === 'string' &&
    typeof o['nickname'] === 'string' &&
    typeof o['rating'] === 'number' &&
    typeof o['isBot'] === 'boolean' &&
    typeof o['wpm'] === 'number' &&
    typeof record === 'object' &&
    record !== null &&
    Array.isArray(record['events']) &&
    typeof record['targetText'] === 'string'
  );
};

/** Finds an opponent (real ghost or labelled bot) and starts a duel session on the server. */
export const startDuel = async (
  deviceToken: string,
  lang: 'en' | 'tr',
  rematchSessionId?: string,
  fetchFn: FetchLike = defaultFetch,
): Promise<{ readonly ok: true; readonly duel: DuelStart } | Failure> => {
  const reply = await post(
    '/api/duel/start',
    deviceToken,
    rematchSessionId ? { lang, rematchSessionId } : { lang },
    fetchFn,
  );
  if (reply === 'network') return { ok: false, error: 'network' };
  const body = reply.body;
  if (
    reply.status !== 201 ||
    !body ||
    typeof body['sessionId'] !== 'string' ||
    typeof body['sessionToken'] !== 'string' ||
    typeof body['text'] !== 'string' ||
    !isOpponent(body['opponent'])
  ) {
    return failureFor(reply.status);
  }
  return {
    ok: true,
    duel: {
      sessionId: body['sessionId'],
      sessionToken: body['sessionToken'],
      lang,
      text: body['text'],
      opponent: body['opponent'],
    },
  };
};

export interface DuelSubmission {
  readonly sessionId: string;
  readonly sessionToken: string;
  readonly events: readonly KeyEvent[];
  readonly durationMs: number;
}

/** Sends the recorded keystrokes; the server recomputes everything and returns the official result. */
export const submitDuel = async (
  deviceToken: string,
  submission: DuelSubmission,
  fetchFn: FetchLike = defaultFetch,
): Promise<{ readonly ok: true; readonly outcome: DuelOutcome } | Failure> => {
  const reply = await post('/api/duel/submit', deviceToken, submission, fetchFn);
  if (reply === 'network') return { ok: false, error: 'network' };
  const body = reply.body;
  if (reply.status !== 200 || !body || typeof body['duel'] !== 'object' || body['duel'] === null) {
    return failureFor(reply.status);
  }
  return { ok: true, outcome: body as unknown as DuelOutcome };
};
