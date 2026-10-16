import { Hono } from 'hono';
import { cors } from './cors';
import { admin } from './routes/admin';
import { duel } from './routes/duel';
import { events } from './routes/events';
import { leaderboard } from './routes/leaderboard';
import { player } from './routes/player';
import { profile } from './routes/profile';
import { session } from './routes/session';
import type { AppContext } from './types';

/** The clock is injectable so tests can control time. */
export const createApp = (clock: () => number = Date.now): Hono<AppContext> => {
  const app = new Hono<AppContext>();

  app.use('*', async (context, next) => {
    context.set('now', clock);
    await next();
  });

  app.use('/api/*', cors());

  app.get('/health', (context) => context.json({ status: 'ok' }));

  app.get('/health/db', async (context) => {
    try {
      await context.env.DB.prepare('SELECT 1 AS ok').first();
      return context.json({ status: 'ok', db: true });
    } catch {
      return context.json({ status: 'error', db: false }, 500);
    }
  });

  app.route('/api/player', player);
  app.route('/api/events', events);
  app.route('/api/admin', admin);
  app.route('/api/session', session);
  app.route('/api/duel', duel);
  app.route('/api/profile', profile);
  app.route('/api/leaderboard', leaderboard);

  return app;
};

export default createApp();
