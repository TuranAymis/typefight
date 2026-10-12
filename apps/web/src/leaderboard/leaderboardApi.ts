export type BoardLang = 'en' | 'tr';
export type BoardPeriod = 'daily' | 'all';

export interface BoardEntry {
  readonly rank: number;
  readonly playerId: string;
  readonly nickname: string;
  readonly wpm: number;
  readonly accuracy: number;
}

export interface Board {
  readonly entries: readonly BoardEntry[];
  readonly me: BoardEntry | null;
}

export type BoardResult =
  | { readonly ok: true; readonly board: Board }
  | { readonly ok: false; readonly error: 'network' | 'server' };

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const isEntry = (value: unknown): value is BoardEntry => {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry['rank'] === 'number' &&
    typeof entry['playerId'] === 'string' &&
    typeof entry['nickname'] === 'string' &&
    typeof entry['wpm'] === 'number' &&
    typeof entry['accuracy'] === 'number'
  );
};

/** Loads one leaderboard page. The device token (if any) makes the server also return `me`. */
export const fetchLeaderboard = async (
  lang: BoardLang,
  period: BoardPeriod,
  deviceToken?: string,
  fetchFn: FetchLike = (input, init) => fetch(input, init),
): Promise<BoardResult> => {
  const init: RequestInit = deviceToken
    ? { headers: { Authorization: `Bearer ${deviceToken}` } }
    : {};
  let response: Response;
  try {
    response = await fetchFn(`/api/leaderboard?lang=${lang}&period=${period}`, init);
  } catch {
    return { ok: false, error: 'network' };
  }
  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok || !body || !Array.isArray(body['entries'])) {
    return { ok: false, error: 'server' };
  }
  return {
    ok: true,
    board: {
      entries: body['entries'].filter(isEntry),
      me: isEntry(body['me']) ? body['me'] : null,
    },
  };
};
