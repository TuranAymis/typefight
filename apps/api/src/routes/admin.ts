import { Hono } from 'hono';
import { sha256Hex } from '../crypto';
import { computeMetrics } from '../metrics';
import type { AppContext } from '../types';

export const admin = new Hono<AppContext>();

/** GET /api/admin/metrics?days=30: product metrics. Off unless the METRICS_TOKEN secret is set. */
admin.get('/metrics', async (context) => {
  const secret = context.env.METRICS_TOKEN;
  if (!secret) return context.json({ error: 'not_found' }, 404);
  const header = context.req.header('Authorization') ?? '';
  const given = /^Bearer (.+)$/.exec(header)?.[1] ?? '';
  // Compare hashes so the check does not depend on where two strings first differ.
  const [expected, actual] = await Promise.all([sha256Hex(secret), sha256Hex(given)]);
  if (expected !== actual) return context.json({ error: 'unauthorized' }, 401);
  const requested = Number(context.req.query('days') ?? 30);
  const days = Number.isFinite(requested) ? requested : 30;
  return context.json(await computeMetrics(context.env.DB, context.get('now')(), days));
});
