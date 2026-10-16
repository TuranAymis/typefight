ALTER TABLE players ADD COLUMN cursor_effect TEXT DEFAULT 'default';

-- Per-player write budget, independent of recovery attempts.
CREATE TABLE cursor_effect_attempts (
  player_id TEXT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  window_start INTEGER NOT NULL,
  attempts INTEGER NOT NULL
);
