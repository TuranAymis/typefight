import { Hono } from 'hono';
import { bearerToken, findPlayerByToken } from '../auth';
import type { AppContext } from '../types';

export const leaderboard = new Hono<AppContext>();

export const LEADERBOARD_CACHE_MS = 60_000;
export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 100;
/** Runs below this accuracy do not rank, so spamming random keys cannot top the board. */
export const MIN_RANKED_ACCURACY = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  nickname: string;
  wpm: number;
  accuracy: number;
}

interface CacheItem {
  expiresAt: number;
  entries: LeaderboardEntry[];
}

// Per-isolate cache; fine because the data is public and a minute of staleness is accepted.
const cache = new Map<string, CacheItem>();
export const clearLeaderboardCache = (): void => cache.clear();

interface RankedRow {
  player_id: string;
  nickname: string;
  wpm: number;
  accuracy: number;
}

// Best verified run per player (highest WPM, earliest wins ties), humans only.
const BEST_RUNS = `
  WITH best AS (
    SELECT s.player_id, p.nickname, s.wpm, s.accuracy,
      ROW_NUMBER() OVER (PARTITION BY s.player_id ORDER BY s.wpm DESC, s.submitted_at ASC) AS position
    FROM sessions s JOIN players p ON p.id = s.player_id
    WHERE s.status = 'submitted' AND s.verified = 1 AND p.is_bot = 0
      AND s.lang = ? AND s.accuracy >= ? AND s.submitted_at >= ?
  )
  SELECT player_id, nickname, wpm, accuracy FROM best WHERE position = 1`;

const loadTop = async (
  db: D1Database,
  lang: string,
  since: number,
  limit: number,
): Promise<LeaderboardEntry[]> => {
  const { results } = await db
    .prepare(`${BEST_RUNS} ORDER BY wpm DESC, nickname ASC LIMIT ?`)
    .bind(lang, MIN_RANKED_ACCURACY, since, limit)
    .all<RankedRow>();
  return results.map((row, index) => ({
    rank: index + 1,
    playerId: row.player_id,
    nickname: row.nickname,
    wpm: row.wpm,
    accuracy: row.accuracy,
  }));
};

const loadRankOf = async (
  db: D1Database,
  lang: string,
  since: number,
  playerId: string,
): Promise<LeaderboardEntry | null> => {
  const mine = await db
    .prepare(`${BEST_RUNS} AND player_id = ?`)
    .bind(lang, MIN_RANKED_ACCURACY, since, playerId)
    .first<RankedRow>();
  if (!mine) return null;
  const ahead = await db
    .prepare(
      `SELECT COUNT(*) AS total FROM (${BEST_RUNS}) WHERE wpm > ? OR (wpm = ? AND nickname < ?)`,
    )
    .bind(lang, MIN_RANKED_ACCURACY, since, mine.wpm, mine.wpm, mine.nickname)
    .first<{ total: number }>();
  return {
    rank: (ahead?.total ?? 0) + 1,
    playerId: mine.player_id,
    nickname: mine.nickname,
    wpm: mine.wpm,
    accuracy: mine.accuracy,
  };
};

/**
 * GET /api/leaderboard?lang=en|tr&period=daily|all&limit=50
 * Verified runs only. The public list is cached for 60 s; if the caller sends a device token the
 * response also contains `me` (their own rank, even when outside the top list).
 */
leaderboard.get('/', async (context) => {
  const lang = context.req.query('lang') ?? 'en';
  const period = context.req.query('period') ?? 'all';
  const limitParam = Number(context.req.query('limit') ?? DEFAULT_LIMIT);
  if (lang !== 'en' && lang !== 'tr') return context.json({ error: 'invalid_lang' }, 400);
  if (period !== 'daily' && period !== 'all') return context.json({ error: 'invalid_period' }, 400);
  if (!Number.isInteger(limitParam) || limitParam < 1 || limitParam > MAX_LIMIT) {
    return context.json({ error: 'invalid_limit' }, 400);
  }

  const now = context.get('now')();
  const since = period === 'daily' ? now - (now % DAY_MS) : 0;
  const key = `${lang}|${period}|${since}|${limitParam}`;
  let item = cache.get(key);
  if (!item || item.expiresAt <= now) {
    item = {
      expiresAt: now + LEADERBOARD_CACHE_MS,
      entries: await loadTop(context.env.DB, lang, since, limitParam),
    };
    cache.set(key, item);
  }

  let me: LeaderboardEntry | null | undefined;
  if (bearerToken(context)) {
    const current = await findPlayerByToken(context);
    if (current) me = await loadRankOf(context.env.DB, lang, since, current.id);
  }

  context.header(
    'Cache-Control',
    `${me === undefined ? 'public' : 'private'}, max-age=${LEADERBOARD_CACHE_MS / 1000}`,
  );
  return context.json({
    lang,
    period,
    cachedUntil: item.expiresAt,
    entries: item.entries,
    ...(me === undefined ? {} : { me }),
  });
});
