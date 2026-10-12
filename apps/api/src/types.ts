export interface Env {
  DB: D1Database;
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
