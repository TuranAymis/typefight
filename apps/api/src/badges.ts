import { BADGES, BADGE_MIN_ACCURACY_RUN_MS } from '@typefight/texts';
import type { BadgeDefinition } from '@typefight/texts';

interface Stats {
  duelsPlayed: number;
  duelsWon: number;
  bestWpm: number;
  bestLongAccuracy: number;
}

const loadStats = async (db: D1Database, playerId: string): Promise<Stats> => {
  const duels = await db
    .prepare(
      `SELECT COUNT(*) AS played, COALESCE(SUM(CASE WHEN winner = 'player' THEN 1 ELSE 0 END), 0) AS won
       FROM duels WHERE player_id = ?`,
    )
    .bind(playerId)
    .first<{ played: number; won: number }>();
  const runs = await db
    .prepare(
      `SELECT COALESCE(MAX(wpm), 0) AS best_wpm,
         COALESCE(MAX(CASE WHEN duration_ms >= ? THEN accuracy END), 0) AS best_accuracy
       FROM sessions WHERE player_id = ? AND status = 'submitted' AND verified = 1`,
    )
    .bind(BADGE_MIN_ACCURACY_RUN_MS, playerId)
    .first<{ best_wpm: number; best_accuracy: number }>();
  return {
    duelsPlayed: duels?.played ?? 0,
    duelsWon: duels?.won ?? 0,
    bestWpm: runs?.best_wpm ?? 0,
    bestLongAccuracy: runs?.best_accuracy ?? 0,
  };
};

const CONDITIONS: Readonly<Record<string, (stats: Stats) => boolean>> = {
  'first-duel': (s) => s.duelsPlayed >= 1,
  'first-win': (s) => s.duelsWon >= 1,
  'wins-10': (s) => s.duelsWon >= 10,
  'wins-50': (s) => s.duelsWon >= 50,
  'wpm-50': (s) => s.bestWpm >= 50,
  'wpm-75': (s) => s.bestWpm >= 75,
  'wpm-100': (s) => s.bestWpm >= 100,
  'wpm-120': (s) => s.bestWpm >= 120,
  'accuracy-95': (s) => s.bestLongAccuracy >= 95,
  'accuracy-99': (s) => s.bestLongAccuracy >= 99,
};

/**
 * Grants every badge whose condition is now met and returns the ones that are new. Call after a
 * verified result has been stored. A badge is earned once (primary key + INSERT OR IGNORE), so
 * calling this repeatedly is safe. Unverified runs never count because stats read verified rows only.
 */
export const awardBadges = async (
  db: D1Database,
  playerId: string,
  now: number,
): Promise<readonly BadgeDefinition[]> => {
  const [stats, owned] = await Promise.all([
    loadStats(db, playerId),
    db
      .prepare('SELECT badge_id FROM badges WHERE player_id = ?')
      .bind(playerId)
      .all<{ badge_id: string }>(),
  ]);
  const have = new Set(owned.results.map((row) => row.badge_id));
  const fresh: BadgeDefinition[] = [];
  for (const badge of BADGES) {
    if (have.has(badge.id) || !CONDITIONS[badge.id]?.(stats)) continue;
    const insert = await db
      .prepare('INSERT OR IGNORE INTO badges (player_id, badge_id, earned_at) VALUES (?, ?, ?)')
      .bind(playerId, badge.id, now)
      .run();
    if (insert.meta.changes > 0) fresh.push(badge);
  }
  return fresh;
};
