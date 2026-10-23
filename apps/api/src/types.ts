export interface Env {
  DB: D1Database;
  /** Secret that unlocks /api/admin/metrics. Unset = the endpoint does not exist. */
  METRICS_TOKEN?: string;
  /** Comma separated origins (https://*.example.com allowed) that may call the API from a browser. */
  ALLOWED_ORIGINS?: string;
  /** "1" lifts the per-IP limit on new profiles (local dev and staging only; never set in production). */
  DISABLE_PLAYER_LIMIT?: string;
}

export interface AppContext {
  Bindings: Env;
  Variables: { now: () => number };
}

export interface PlayerRow {
  id: string;
  nickname: string;
  token_hash: string;
  is_bot: number;
  rating: number;
  created_at: number;
}
