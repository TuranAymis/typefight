import { glitchForText } from './duelText';
import type { SessionRecord } from '@typefight/engine';
import type { TextPassage } from '@typefight/texts';
import { ensureBotSession, nearestBotLevel } from './bots';

export const RATING_WINDOWS = [100, 200, 400, 800] as const;
export const RECENT_OPPONENT_LIMIT = 10;

export interface Opponent {
  readonly sessionId: string;
  readonly playerId: string;
  readonly nickname: string;
  readonly rating: number;
  readonly isBot: boolean;
  readonly wpm: number;
  readonly record: SessionRecord;
}

interface GhostRow {
  session_id: string;
  player_id: string;
  nickname: string;
  rating: number;
  is_bot: number;
  wpm: number;
  record_json: string;
}

const toOpponent = (row: GhostRow): Opponent => ({
  sessionId: row.session_id,
  playerId: row.player_id,
  nickname: row.nickname,
  rating: row.rating,
  isBot: row.is_bot === 1,
  wpm: row.wpm,
  record: JSON.parse(row.record_json) as SessionRecord,
});

const GHOST_SELECT = `
  SELECT s.id AS session_id, s.player_id, p.nickname, p.rating, p.is_bot, s.wpm, s.record_json
  FROM sessions s JOIN players p ON p.id = s.player_id`;

/**
 * A real past run on the same language and text, from a verified session of someone else who is not
 * among the player's last 10 opponents. Starts at +-100 rating and widens; closest rating wins.
 */
export const findRealGhost = async (
  db: D1Database,
  input: { playerId: string; rating: number; lang: 'en' | 'tr'; textId: string },
): Promise<Opponent | undefined> => {
  for (const window of RATING_WINDOWS) {
    const row = await db
      .prepare(
        `${GHOST_SELECT}
         WHERE s.status = 'submitted' AND s.verified = 1 AND s.record_json IS NOT NULL
           AND s.lang = ? AND s.text_id = ? AND p.is_bot = 0 AND s.player_id != ?
           AND s.player_id NOT IN (
             SELECT opponent_id FROM duels
             WHERE player_id = ? AND opponent_id IS NOT NULL
             ORDER BY created_at DESC LIMIT ${RECENT_OPPONENT_LIMIT})
           AND ABS(p.rating - ?) <= ?
         ORDER BY ABS(p.rating - ?) ASC, s.submitted_at DESC LIMIT 1`,
      )
      .bind(
        input.lang,
        input.textId,
        input.playerId,
        input.playerId,
        input.rating,
        window,
        input.rating,
      )
      .first<GhostRow>();
    if (row) return toOpponent(row);
  }
  return undefined;
};

/**
 * The same opponent run again (rematch): only verified submitted runs of the requested language,
 * never the player's own run.
 */
export const findOpponentBySession = async (
  db: D1Database,
  input: { playerId: string; sessionId: string; lang: 'en' | 'tr' },
): Promise<Opponent | undefined> => {
  const row = await db
    .prepare(
      `${GHOST_SELECT}
       WHERE s.id = ? AND s.status = 'submitted' AND s.verified = 1 AND s.record_json IS NOT NULL
         AND s.lang = ? AND s.player_id != ?`,
    )
    .bind(input.sessionId, input.lang, input.playerId)
    .first<GhostRow>();
  return row ? toOpponent(row) : undefined;
};

/** Typical speed of the player, used to choose a bot level. New players start at 50 WPM. */
export const expectedWpm = async (db: D1Database, playerId: string): Promise<number> => {
  const row = await db
    .prepare(
      `SELECT AVG(wpm) AS average FROM (
         SELECT wpm FROM sessions WHERE player_id = ? AND status = 'submitted' AND verified = 1
         ORDER BY submitted_at DESC LIMIT 10)`,
    )
    .bind(playerId)
    .first<{ average: number | null }>();
  return row?.average ?? 50;
};

/** Always returns an opponent: a real ghost when one fits, otherwise a clearly labelled bot. */
export const findOpponent = async (
  db: D1Database,
  now: number,
  input: { playerId: string; rating: number; lang: 'en' | 'tr'; passage: TextPassage },
): Promise<Opponent> => {
  const ghost = await findRealGhost(db, {
    playerId: input.playerId,
    rating: input.rating,
    lang: input.lang,
    textId: input.passage.id,
  });
  const glitch = glitchForText(input.passage.id, input.passage.text, input.lang);
  if (
    ghost &&
    ghost.record.targetText === input.passage.text &&
    JSON.stringify(ghost.record.glitch) === JSON.stringify(glitch)
  )
    return ghost;

  const level = nearestBotLevel(await expectedWpm(db, input.playerId));
  const sessionId = await ensureBotSession(db, now, level, input.passage);
  const row = await db.prepare(`${GHOST_SELECT} WHERE s.id = ?`).bind(sessionId).first<GhostRow>();
  if (!row) throw new Error('bot session missing after creation');
  return toOpponent(row);
};
