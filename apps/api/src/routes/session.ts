import { Hono } from 'hono';
import { computeResult, RECORD_VERSION } from '@typefight/engine';
import type { KeyEvent, SessionRecord } from '@typefight/engine';
import { pickPassage } from '@typefight/texts';
import { isHistoricalJump, rhythmFlags } from '../antiCheat';
import { findPlayerByToken } from '../auth';
import { randomId, randomSeed, randomToken, sha256Hex } from '../crypto';
import { clientIpHash, tooManySessionStarts } from '../rateLimit';
import type { AppContext } from '../types';

export const session = new Hono<AppContext>();

export const SESSION_MODES = ['simulator'] as const;
/** A session must be submitted within this window after it started. */
export const SESSION_TTL_MS = 15 * 60 * 1000;
/** Client duration may exceed the server-measured time by this much (network + clock jitter). */
export const DURATION_TOLERANCE_MS = 3000;
export const MAX_EVENTS = 5000;
export const MAX_DURATION_MS = 10 * 60 * 1000;

interface SessionRow {
  id: string;
  player_id: string;
  lang: 'en' | 'tr';
  target_text: string;
  token_hash: string;
  status: string;
  started_at: number;
}

/** POST /api/session/start: the server picks the text and seed, the client cannot. */
session.post('/start', async (context) => {
  const current = await findPlayerByToken(context);
  if (!current) return context.json({ error: 'unauthorized' }, 401);

  const body = (await context.req.json().catch(() => ({}))) as { mode?: unknown; lang?: unknown };
  const mode = body.mode ?? 'simulator';
  const lang = body.lang ?? 'en';
  if (!SESSION_MODES.includes(mode as (typeof SESSION_MODES)[number])) {
    return context.json({ error: 'invalid_mode' }, 400);
  }
  if (lang !== 'en' && lang !== 'tr') return context.json({ error: 'invalid_lang' }, 400);

  const now = context.get('now')();
  const ipHash = await clientIpHash(context);
  if (await tooManySessionStarts(context.env.DB, now, current.id, ipHash)) {
    return context.json({ error: 'rate_limited' }, 429, { 'Retry-After': '600' });
  }

  const seed = randomSeed();
  const passage = pickPassage(lang, seed);
  const id = randomId();
  const sessionToken = randomToken();
  await context.env.DB.prepare(
    `INSERT INTO sessions (id, player_id, mode, lang, text_id, target_text, seed, token_hash, started_at, ip_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      current.id,
      mode,
      lang,
      passage.id,
      passage.text,
      seed,
      await sha256Hex(sessionToken),
      now,
      ipHash,
    )
    .run();
  return context.json(
    { sessionId: id, mode, lang, textId: passage.id, text: passage.text, seed, sessionToken },
    201,
  );
});

const parseEvents = (value: unknown): KeyEvent[] | undefined => {
  if (!Array.isArray(value) || value.length > MAX_EVENTS) return undefined;
  const events: KeyEvent[] = [];
  let previous = 0;
  for (const item of value) {
    if (typeof item !== 'object' || item === null) return undefined;
    const { t, key } = item as { t?: unknown; key?: unknown };
    if (typeof t !== 'number' || !Number.isFinite(t) || t < previous) return undefined;
    if (typeof key !== 'string' || key.length === 0 || key.length > 16) return undefined;
    events.push({ t, key });
    previous = t;
  }
  return events;
};

/**
 * POST /api/session/submit: the client only sends what it typed. The official result is
 * recomputed here with the same engine function the client uses; client-reported scores are ignored.
 */
session.post('/submit', async (context) => {
  const current = await findPlayerByToken(context);
  if (!current) return context.json({ error: 'unauthorized' }, 401);

  const body = (await context.req.json().catch(() => ({}))) as {
    sessionId?: unknown;
    sessionToken?: unknown;
    events?: unknown;
    durationMs?: unknown;
  };
  if (typeof body.sessionId !== 'string' || typeof body.sessionToken !== 'string') {
    return context.json({ error: 'invalid_request' }, 400);
  }
  const events = parseEvents(body.events);
  const durationMs = body.durationMs;
  if (
    !events ||
    typeof durationMs !== 'number' ||
    !Number.isFinite(durationMs) ||
    durationMs <= 0 ||
    durationMs > MAX_DURATION_MS
  ) {
    return context.json({ error: 'invalid_record' }, 400);
  }

  const row = await context.env.DB.prepare('SELECT * FROM sessions WHERE id = ? AND player_id = ?')
    .bind(body.sessionId, current.id)
    .first<SessionRow>();
  if (!row) return context.json({ error: 'unknown_session' }, 404);
  if (row.token_hash !== (await sha256Hex(body.sessionToken))) {
    return context.json({ error: 'bad_session_token' }, 403);
  }
  if (row.status !== 'started') return context.json({ error: 'already_submitted' }, 409);

  const now = context.get('now')();
  const elapsed = now - row.started_at;
  if (elapsed > SESSION_TTL_MS) return context.json({ error: 'session_expired' }, 410);
  const lastEvent = events[events.length - 1];
  if (
    durationMs > elapsed + DURATION_TOLERANCE_MS ||
    (lastEvent !== undefined && lastEvent.t > durationMs)
  ) {
    return context.json({ error: 'impossible_timing' }, 422);
  }

  const record: SessionRecord = {
    version: RECORD_VERSION,
    targetText: row.target_text,
    locale: row.lang,
    events,
    durationMs,
  };
  const result = computeResult(record);

  // Suspicious runs are stored but unverified: out of ghost/leaderboard pools, player not blocked.
  const flags: string[] = rhythmFlags(events, result);
  const history = await context.env.DB.prepare(
    `SELECT wpm FROM sessions WHERE player_id = ? AND status = 'submitted' AND verified = 1
     ORDER BY submitted_at DESC LIMIT 20`,
  )
    .bind(current.id)
    .all<{ wpm: number }>();
  if (
    isHistoricalJump(
      result.wpm,
      history.results.map((row) => row.wpm),
    )
  )
    flags.push('wpm_jump');
  const verified = flags.length === 0;

  // Guarded by status so a double submit cannot record twice.
  const update = await context.env.DB.prepare(
    `UPDATE sessions SET status = 'submitted', submitted_at = ?, duration_ms = ?, wpm = ?, raw_wpm = ?,
       accuracy = ?, consistency = ?, record_json = ?, verified = ?, flags = ? WHERE id = ? AND status = 'started'`,
  )
    .bind(
      now,
      durationMs,
      result.wpm,
      result.rawWpm,
      result.accuracy,
      result.consistency,
      JSON.stringify(record),
      verified ? 1 : 0,
      flags.length > 0 ? flags.join(',') : null,
      row.id,
    )
    .run();
  if (update.meta.changes === 0) return context.json({ error: 'already_submitted' }, 409);
  // Flags stay server-side so cheaters cannot tune against them.
  return context.json({ sessionId: row.id, result, verified });
});
