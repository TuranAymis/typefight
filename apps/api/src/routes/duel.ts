import { Hono } from 'hono';
import { simulateDuel, updateRatings } from '@typefight/engine';
import type { SessionRecord } from '@typefight/engine';
import { pickPassage, TEXT_POOL } from '@typefight/texts';
import { findPlayerByToken } from '../auth';
import { randomId, randomSeed } from '../crypto';
import { findOpponent, findOpponentBySession } from '../matchmaking';
import { finishSession, isFailure, isLang, startSession } from '../sessionService';
import type { AppContext } from '../types';

export const duel = new Hono<AppContext>();

/**
 * POST /api/duel/start: picks the text, finds a ghost on that text (real run or labelled bot) and
 * starts a duel session. The opponent's record is returned so the client can replay it.
 */
duel.post('/start', async (context) => {
  const current = await findPlayerByToken(context);
  if (!current) return context.json({ error: 'unauthorized' }, 401);
  const body = (await context.req.json().catch(() => ({}))) as {
    lang?: unknown;
    rematchSessionId?: unknown;
  };
  const lang = body.lang ?? 'en';
  if (!isLang(lang)) return context.json({ error: 'invalid_lang' }, 400);

  // Rematch: same opponent run on the same text. Otherwise pick a text and match on it.
  let passage = pickPassage(lang, randomSeed());
  let rematch: Awaited<ReturnType<typeof findOpponentBySession>>;
  if (body.rematchSessionId !== undefined) {
    if (typeof body.rematchSessionId !== 'string') {
      return context.json({ error: 'invalid_rematch' }, 400);
    }
    rematch = await findOpponentBySession(context.env.DB, {
      playerId: current.id,
      sessionId: body.rematchSessionId,
      lang,
    });
    const rematchPassage = TEXT_POOL.find(
      (entry) => entry.lang === lang && entry.text === rematch?.record.targetText,
    );
    if (!rematch || !rematchPassage) return context.json({ error: 'invalid_rematch' }, 404);
    passage = rematchPassage;
  }
  const opponent =
    rematch ??
    (await findOpponent(context.env.DB, context.get('now')(), {
      playerId: current.id,
      rating: current.rating,
      lang,
      passage,
    }));
  const started = await startSession(context, current, 'duel', lang, {
    passage,
    ghostSessionId: opponent.sessionId,
  });
  if (isFailure(started)) {
    return context.json({ error: started.error }, started.status, started.headers);
  }
  return context.json(
    {
      ...started,
      opponent: {
        sessionId: opponent.sessionId,
        nickname: opponent.nickname,
        rating: opponent.rating,
        isBot: opponent.isBot,
        wpm: opponent.wpm,
        record: opponent.record,
      },
    },
    201,
  );
});

interface GhostRow {
  player_id: string;
  record_json: string;
  rating: number;
  is_bot: number;
}

/**
 * POST /api/duel/submit: recomputes the player's result, plays the duel against the stored ghost
 * with the engine, records it and updates ratings. Unverified (suspicious) runs never move ratings.
 */
duel.post('/submit', async (context) => {
  const current = await findPlayerByToken(context);
  if (!current) return context.json({ error: 'unauthorized' }, 401);
  const body = (await context.req.json().catch(() => ({}))) as Record<string, unknown>;

  const finished = await finishSession(context, current, 'duel', body);
  if (isFailure(finished)) return context.json({ error: finished.error }, finished.status);

  const db = context.env.DB;
  const ghost = finished.row.ghost_session_id
    ? await db
        .prepare(
          `SELECT s.player_id, s.record_json, p.rating, p.is_bot FROM sessions s
           JOIN players p ON p.id = s.player_id WHERE s.id = ?`,
        )
        .bind(finished.row.ghost_session_id)
        .first<GhostRow>()
    : null;
  if (!ghost) return context.json({ error: 'ghost_missing' }, 409);

  const outcome = simulateDuel(finished.record, JSON.parse(ghost.record_json) as SessionRecord);
  const winner = outcome.winner === 'a' ? 'player' : outcome.winner === 'b' ? 'opponent' : 'draw';
  const isBot = ghost.is_bot === 1;

  const before = current.rating;
  let after = before;
  let opponentAfter = ghost.rating;
  if (finished.verified) {
    const update = updateRatings(before, ghost.rating, outcome.winner);
    after = update.a;
    // Bots keep their fixed rating; real ghost owners are updated too.
    opponentAfter = isBot ? ghost.rating : update.b;
    await db.prepare('UPDATE players SET rating = ? WHERE id = ?').bind(after, current.id).run();
    if (!isBot) {
      await db
        .prepare('UPDATE players SET rating = ? WHERE id = ?')
        .bind(opponentAfter, ghost.player_id)
        .run();
    }
  }

  await db
    .prepare(
      `INSERT INTO duels (id, player_id, opponent_id, player_session_id, ghost_session_id, winner, created_at,
         opponent_is_bot, reason, rating_before, rating_after, opponent_rating_before, opponent_rating_after)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      randomId(),
      current.id,
      ghost.player_id,
      finished.row.id,
      finished.row.ghost_session_id,
      winner,
      context.get('now')(),
      isBot ? 1 : 0,
      outcome.reason,
      before,
      after,
      ghost.rating,
      opponentAfter,
    )
    .run();

  return context.json({
    sessionId: finished.row.id,
    result: finished.result,
    verified: finished.verified,
    duel: {
      winner,
      reason: outcome.reason,
      hp: outcome.hp,
      endedAt: outcome.endedAt,
      rating: { before, after, delta: after - before },
      ratingApplied: finished.verified,
    },
  });
});
