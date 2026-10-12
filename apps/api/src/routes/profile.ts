import { Hono } from 'hono';
import type { AppContext } from '../types';

export const profile = new Hono<AppContext>();

interface StatsRow {
  sessions_count: number;
  best_wpm: number | null;
  avg_accuracy: number | null;
}

interface DuelRow {
  winner: 'player' | 'opponent' | 'draw';
  total: number;
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

/** GET /api/profile/:id: public stats computed from submitted sessions and recorded duels. */
profile.get('/:id', async (context) => {
  const id = context.req.param('id');
  const db = context.env.DB;
  const found = await db
    .prepare('SELECT id, nickname, rating, created_at FROM players WHERE id = ? AND is_bot = 0')
    .bind(id)
    .first<{ id: string; nickname: string; rating: number; created_at: number }>();
  if (!found) return context.json({ error: 'not_found' }, 404);

  const stats = await db
    .prepare(
      `SELECT COUNT(*) AS sessions_count, MAX(wpm) AS best_wpm, AVG(accuracy) AS avg_accuracy
       FROM sessions WHERE player_id = ? AND status = 'submitted'`,
    )
    .bind(id)
    .first<StatsRow>();
  const duelRows = await db
    .prepare('SELECT winner, COUNT(*) AS total FROM duels WHERE player_id = ? GROUP BY winner')
    .bind(id)
    .all<DuelRow>();

  const duels = { played: 0, won: 0, lost: 0, drawn: 0 };
  for (const row of duelRows.results) {
    duels.played += row.total;
    if (row.winner === 'player') duels.won = row.total;
    else if (row.winner === 'opponent') duels.lost = row.total;
    else duels.drawn = row.total;
  }

  return context.json({
    playerId: found.id,
    nickname: found.nickname,
    rating: found.rating,
    createdAt: found.created_at,
    sessions: stats?.sessions_count ?? 0,
    bestWpm: stats?.best_wpm ?? 0,
    averageAccuracy: round2(stats?.avg_accuracy ?? 0),
    duels,
  });
});
