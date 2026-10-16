import { Hono } from 'hono';
import {
  CLIENT_ID_PATTERN,
  MAX_EVENTS_PER_REQUEST,
  isAnalyticsEventName,
  validateEventProps,
} from '@typefight/texts';
import type { AnalyticsEventName, AnalyticsProps } from '@typefight/texts';
import type { AppContext } from '../types';

export const events = new Hono<AppContext>();

/** One device cannot write more than this many events an hour (a typo or a loop must not fill D1). */
export const MAX_EVENTS_PER_CLIENT_HOUR = 600;
const HOUR_MS = 60 * 60 * 1000;
const MAX_BODY_BYTES = 4096;

export const utcDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

interface ValidEvent {
  readonly name: AnalyticsEventName;
  readonly props: AnalyticsProps;
}

const parseEvents = (body: unknown): { clientId: string; list: ValidEvent[] } | null => {
  if (typeof body !== 'object' || body === null) return null;
  const { clientId, events: raw } = body as { clientId?: unknown; events?: unknown };
  if (typeof clientId !== 'string' || !CLIENT_ID_PATTERN.test(clientId)) return null;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_EVENTS_PER_REQUEST) return null;
  const list: ValidEvent[] = [];
  for (const item of raw as unknown[]) {
    if (typeof item !== 'object' || item === null) return null;
    const { name, props } = item as { name?: unknown; props?: unknown };
    if (!isAnalyticsEventName(name)) return null;
    const clean = validateEventProps(name, props);
    if (!clean) return null;
    list.push({ name, props: clean });
  }
  return { clientId, list };
};

/**
 * POST /api/events: a batch of anonymous product events. The whole batch is rejected if any event is
 * not in the schema. Client clocks are ignored: the server stamps every event.
 */
events.post('/', async (context) => {
  const text = await context.req.text();
  if (text.length > MAX_BODY_BYTES) return context.json({ error: 'too_large' }, 413);
  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {
    // Falls through to the validation error below.
  }
  const parsed = parseEvents(body);
  if (!parsed) return context.json({ error: 'invalid_events' }, 400);

  const db = context.env.DB;
  const now = context.get('now')();
  const recent = await db
    .prepare(
      'SELECT COUNT(*) AS total FROM analytics_events WHERE client_id = ? AND created_at > ?',
    )
    .bind(parsed.clientId, now - HOUR_MS)
    .first<{ total: number }>();
  if ((recent?.total ?? 0) + parsed.list.length > MAX_EVENTS_PER_CLIENT_HOUR) {
    return context.json({ error: 'rate_limited' }, 429, { 'Retry-After': '3600' });
  }

  for (const event of parsed.list) {
    await db
      .prepare(
        'INSERT INTO analytics_events (client_id, name, day, created_at, props) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(parsed.clientId, event.name, utcDay(now), now, JSON.stringify(event.props))
      .run();
  }
  return context.json({ accepted: parsed.list.length }, 202);
});
