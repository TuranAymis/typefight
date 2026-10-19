import { glitchForText } from './duelText';
import type { Context } from 'hono';
import { computeResult, RECORD_VERSION } from '@typefight/engine';
import type { KeyEvent, SessionRecord, SessionResult } from '@typefight/engine';
import { pickPassage } from '@typefight/texts';
import type { TextPassage } from '@typefight/texts';
import { isHistoricalJump, rhythmFlags } from './antiCheat';
import { randomId, randomSeed, randomToken, sha256Hex } from './crypto';
import { clientIpHash, tooManySessionStarts } from './rateLimit';
import type { AppContext, PlayerRow } from './types';

export type SessionMode = 'simulator' | 'duel';

/** A session must be submitted within this window after it started. */
export const SESSION_TTL_MS = 15 * 60 * 1000;
/** Client duration may exceed the server-measured time by this much (network + clock jitter). */
export const DURATION_TOLERANCE_MS = 3000;
export const MAX_EVENTS = 5000;
export const MAX_DURATION_MS = 10 * 60 * 1000;

export interface SessionRow {
  id: string;
  player_id: string;
  mode: SessionMode;
  lang: 'en' | 'tr';
  text_id: string;
  target_text: string;
  token_hash: string;
  status: string;
  started_at: number;
  ghost_session_id: string | null;
}

export interface Failure {
  readonly status: 400 | 403 | 404 | 409 | 410 | 422 | 429;
  readonly error: string;
  readonly headers?: Record<string, string>;
}

export interface StartedSession {
  readonly sessionId: string;
  readonly mode: SessionMode;
  readonly lang: 'en' | 'tr';
  readonly textId: string;
  readonly text: string;
  readonly seed: number;
  readonly sessionToken: string;
}

export const isLang = (value: unknown): value is 'en' | 'tr' => value === 'en' || value === 'tr';

/** Creates a session row. The server picks the text and the seed, never the client. */
export const startSession = async (
  context: Context<AppContext>,
  player: PlayerRow,
  mode: SessionMode,
  lang: 'en' | 'tr',
  options: { passage?: TextPassage; ghostSessionId?: string } = {},
): Promise<StartedSession | Failure> => {
  const now = context.get('now')();
  const ipHash = await clientIpHash(context);
  if (await tooManySessionStarts(context.env.DB, now, player.id, ipHash)) {
    return { status: 429, error: 'rate_limited', headers: { 'Retry-After': '600' } };
  }
  const seed = randomSeed();
  const passage = options.passage ?? pickPassage(lang, seed);
  const id = randomId();
  const sessionToken = randomToken();
  await context.env.DB.prepare(
    `INSERT INTO sessions (id, player_id, mode, lang, text_id, target_text, seed, token_hash, started_at, ip_hash, ghost_session_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      player.id,
      mode,
      lang,
      passage.id,
      passage.text,
      seed,
      await sha256Hex(sessionToken),
      now,
      ipHash,
      options.ghostSessionId ?? null,
    )
    .run();
  return {
    sessionId: id,
    mode,
    lang,
    textId: passage.id,
    text: passage.text,
    seed,
    sessionToken,
  };
};

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

export interface FinishedSession {
  readonly row: SessionRow;
  readonly record: SessionRecord;
  readonly result: SessionResult;
  readonly verified: boolean;
}

/**
 * Validates a submitted record against the stored session and recomputes the official result with
 * the engine. Client-reported scores are never read. Suspicious runs are stored as unverified.
 */
export const finishSession = async (
  context: Context<AppContext>,
  player: PlayerRow,
  mode: SessionMode,
  body: Record<string, unknown>,
): Promise<FinishedSession | Failure> => {
  if (typeof body['sessionId'] !== 'string' || typeof body['sessionToken'] !== 'string') {
    return { status: 400, error: 'invalid_request' };
  }
  const events = parseEvents(body['events']);
  const durationMs = body['durationMs'];
  if (
    !events ||
    typeof durationMs !== 'number' ||
    !Number.isFinite(durationMs) ||
    durationMs <= 0 ||
    durationMs > MAX_DURATION_MS
  ) {
    return { status: 400, error: 'invalid_record' };
  }

  const db = context.env.DB;
  const row = await db
    .prepare('SELECT * FROM sessions WHERE id = ? AND player_id = ? AND mode = ?')
    .bind(body['sessionId'], player.id, mode)
    .first<SessionRow>();
  if (!row) return { status: 404, error: 'unknown_session' };
  if (row.token_hash !== (await sha256Hex(body['sessionToken']))) {
    return { status: 403, error: 'bad_session_token' };
  }
  if (row.status !== 'started') return { status: 409, error: 'already_submitted' };

  const now = context.get('now')();
  const elapsed = now - row.started_at;
  if (elapsed > SESSION_TTL_MS) return { status: 410, error: 'session_expired' };
  const lastEvent = events[events.length - 1];
  if (
    durationMs > elapsed + DURATION_TOLERANCE_MS ||
    (lastEvent !== undefined && lastEvent.t > durationMs)
  ) {
    return { status: 422, error: 'impossible_timing' };
  }

  const glitch =
    mode === 'duel' ? glitchForText(row.text_id, row.target_text, row.lang) : undefined;
  if (row.text_id.includes(':glitch-v') && !glitch)
    return { status: 409, error: 'glitch_version_unavailable' };
  const record: SessionRecord = {
    ...(glitch ? { glitch } : {}),
    version: RECORD_VERSION,
    targetText: row.target_text,
    locale: row.lang,
    events,
    durationMs,
  };
  const result = computeResult(record);

  const flags: string[] = rhythmFlags(events, result);
  const history = await db
    .prepare(
      `SELECT wpm FROM sessions WHERE player_id = ? AND status = 'submitted' AND verified = 1
       ORDER BY submitted_at DESC LIMIT 20`,
    )
    .bind(player.id)
    .all<{ wpm: number }>();
  if (
    isHistoricalJump(
      result.wpm,
      history.results.map((entry) => entry.wpm),
    )
  ) {
    flags.push('wpm_jump');
  }
  const verified = flags.length === 0;

  // Guarded by status so a double submit cannot record twice.
  const update = await db
    .prepare(
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
  if (update.meta.changes === 0) return { status: 409, error: 'already_submitted' };
  return { row, record, result, verified };
};

export const isFailure = (value: object): value is Failure => 'error' in value;
