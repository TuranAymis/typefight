import { Hono } from 'hono';
import { findPlayerByToken } from '../auth';
import { finishSession, isFailure, isLang, startSession } from '../sessionService';
import type { AppContext } from '../types';

export {
  DURATION_TOLERANCE_MS,
  MAX_DURATION_MS,
  MAX_EVENTS,
  SESSION_TTL_MS,
} from '../sessionService';

export const session = new Hono<AppContext>();

export const SESSION_MODES = ['simulator'] as const;

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
  if (!isLang(lang)) return context.json({ error: 'invalid_lang' }, 400);

  const started = await startSession(context, current, 'simulator', lang);
  if (isFailure(started)) {
    return context.json({ error: started.error }, started.status, started.headers);
  }
  return context.json(started, 201);
});

/**
 * POST /api/session/submit: the client only sends what it typed. The official result is
 * recomputed here with the same engine function the client uses; client-reported scores are ignored.
 */
session.post('/submit', async (context) => {
  const current = await findPlayerByToken(context);
  if (!current) return context.json({ error: 'unauthorized' }, 401);
  const body = (await context.req.json().catch(() => ({}))) as Record<string, unknown>;

  const finished = await finishSession(context, current, 'simulator', body);
  if (isFailure(finished)) return context.json({ error: finished.error }, finished.status);
  // Flags stay server-side so cheaters cannot tune against them.
  return context.json({
    sessionId: finished.row.id,
    result: finished.result,
    verified: finished.verified,
  });
});
