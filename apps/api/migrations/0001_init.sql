-- Core MVP tables. Timestamps are unix epoch milliseconds.

CREATE TABLE players (
  id TEXT PRIMARY KEY,
  nickname TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  is_bot INTEGER NOT NULL DEFAULT 0 CHECK (is_bot IN (0, 1)),
  rating INTEGER NOT NULL DEFAULT 1000,
  created_at INTEGER NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players (id),
  mode TEXT NOT NULL,
  lang TEXT NOT NULL CHECK (lang IN ('en', 'tr')),
  text_id TEXT NOT NULL,
  target_text TEXT NOT NULL,
  seed INTEGER NOT NULL,
  token_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'submitted')),
  started_at INTEGER NOT NULL,
  submitted_at INTEGER,
  duration_ms INTEGER,
  wpm REAL,
  raw_wpm REAL,
  accuracy REAL,
  consistency REAL,
  record_json TEXT
);

CREATE INDEX idx_sessions_player ON sessions (player_id, submitted_at);
-- Ghost matchmaking looks for submitted runs of one mode/language close to a target WPM.
CREATE INDEX idx_sessions_ghost ON sessions (mode, lang, status, wpm);

CREATE TABLE duels (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players (id),
  opponent_id TEXT REFERENCES players (id),
  player_session_id TEXT REFERENCES sessions (id),
  ghost_session_id TEXT REFERENCES sessions (id),
  winner TEXT NOT NULL CHECK (winner IN ('player', 'opponent', 'draw')),
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_duels_player ON duels (player_id, created_at);

CREATE TABLE badges (
  player_id TEXT NOT NULL REFERENCES players (id),
  badge_id TEXT NOT NULL,
  earned_at INTEGER NOT NULL,
  PRIMARY KEY (player_id, badge_id)
);
