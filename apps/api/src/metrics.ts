import { ANALYTICS_EVENTS } from '@typefight/texts';
import type { AnalyticsEventName } from '@typefight/texts';
import { utcDay } from './routes/events';

export interface Retention {
  /** Clients whose first visit is old enough to have had the chance to come back. */
  readonly eligible: number;
  readonly retained: number;
  readonly rate: number | null;
}

export interface Metrics {
  readonly generatedAt: string;
  readonly window: { readonly days: number; readonly from: string; readonly to: string };
  readonly counts: Readonly<Record<AnalyticsEventName, number>>;
  readonly activeClients: number;
  readonly retention: { readonly d1: Retention; readonly d7: Retention };
  readonly duels: {
    readonly completed: number;
    readonly players: number;
    readonly perPlayer: number | null;
    readonly rematches: number;
    readonly rematchRate: number | null;
  };
  readonly daily: readonly { day: string; opens: number; duelsCompleted: number }[];
}

export const MAX_WINDOW_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

const ratio = (part: number, whole: number): number | null =>
  whole === 0 ? null : Math.round((part / whole) * 1000) / 1000;

const retention = async (
  db: D1Database,
  from: string,
  today: string,
  afterDays: number,
): Promise<Retention> => {
  // A visitor counts as retained when they open the game again exactly `afterDays` days after their
  // first visit (UTC dates). Only cohorts old enough to have had that chance are counted.
  const row = await db
    .prepare(
      `WITH first_visit AS (
         SELECT client_id, MIN(day) AS first_day
         FROM analytics_events WHERE name = 'game_open' GROUP BY client_id
       )
       SELECT COUNT(*) AS eligible,
         COALESCE(SUM(EXISTS (
           SELECT 1 FROM analytics_events e
           WHERE e.client_id = first_visit.client_id AND e.name = 'game_open'
             AND e.day = date(first_visit.first_day, '+' || ? || ' day')
         )), 0) AS retained
       FROM first_visit
       WHERE first_day >= ? AND first_day <= date(?, '-' || ? || ' day')`,
    )
    .bind(String(afterDays), from, today, String(afterDays))
    .first<{ eligible: number; retained: number }>();
  const eligible = row?.eligible ?? 0;
  const retained = row?.retained ?? 0;
  return { eligible, retained, rate: ratio(retained, eligible) };
};

/** Product metrics from the anonymous event log, for the last `days` days including today (UTC). */
export const computeMetrics = async (
  db: D1Database,
  now: number,
  days: number,
): Promise<Metrics> => {
  const window = Math.min(Math.max(Math.floor(days), 1), MAX_WINDOW_DAYS);
  const today = utcDay(now);
  const from = utcDay(now - (window - 1) * DAY_MS);

  const counts = Object.fromEntries(
    (Object.keys(ANALYTICS_EVENTS) as AnalyticsEventName[]).map((name) => [name, 0]),
  ) as Record<AnalyticsEventName, number>;
  const countRows = await db
    .prepare('SELECT name, COUNT(*) AS total FROM analytics_events WHERE day >= ? GROUP BY name')
    .bind(from)
    .all<{ name: AnalyticsEventName; total: number }>();
  for (const row of countRows.results) if (row.name in counts) counts[row.name] = row.total;

  const active = await db
    .prepare(
      "SELECT COUNT(DISTINCT client_id) AS total FROM analytics_events WHERE name = 'game_open' AND day >= ?",
    )
    .bind(from)
    .first<{ total: number }>();
  const dueling = await db
    .prepare(
      "SELECT COUNT(DISTINCT client_id) AS total FROM analytics_events WHERE name = 'duel_completed' AND day >= ?",
    )
    .bind(from)
    .first<{ total: number }>();
  const daily = await db
    .prepare(
      `SELECT day,
         COUNT(DISTINCT CASE WHEN name = 'game_open' THEN client_id END) AS opens,
         COALESCE(SUM(name = 'duel_completed'), 0) AS duels_completed
       FROM analytics_events WHERE day >= ? GROUP BY day ORDER BY day`,
    )
    .bind(from)
    .all<{ day: string; opens: number; duels_completed: number }>();

  const players = dueling?.total ?? 0;
  return {
    generatedAt: new Date(now).toISOString(),
    window: { days: window, from, to: today },
    counts,
    activeClients: active?.total ?? 0,
    retention: {
      d1: await retention(db, from, today, 1),
      d7: await retention(db, from, today, 7),
    },
    duels: {
      completed: counts.duel_completed,
      players,
      perPlayer: ratio(counts.duel_completed, players),
      rematches: counts.rematch,
      rematchRate: ratio(counts.rematch, counts.duel_completed),
    },
    daily: daily.results.map((row) => ({
      day: row.day,
      opens: row.opens,
      duelsCompleted: row.duels_completed,
    })),
  };
};
