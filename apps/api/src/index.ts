import { Hono } from 'hono';

const app = new Hono<{ Bindings: { DB: D1Database } }>();

app.get('/health', (context) => context.json({ status: 'ok' }));

app.get('/health/db', async (context) => {
  try {
    await context.env.DB.prepare('SELECT 1 AS ok').first();
    return context.json({ status: 'ok', db: true });
  } catch {
    return context.json({ status: 'error', db: false }, 500);
  }
});

export default app;
