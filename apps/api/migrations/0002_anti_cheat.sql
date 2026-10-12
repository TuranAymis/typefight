-- Anti-abuse columns: suspicious sessions stay stored (verified = 0) but are kept out of ghost/leaderboard queries.

ALTER TABLE players ADD COLUMN ip_hash TEXT;
ALTER TABLE sessions ADD COLUMN ip_hash TEXT;
ALTER TABLE sessions ADD COLUMN verified INTEGER NOT NULL DEFAULT 1 CHECK (verified IN (0, 1));
ALTER TABLE sessions ADD COLUMN flags TEXT;

DROP INDEX idx_sessions_ghost;
CREATE INDEX idx_sessions_ghost ON sessions (mode, lang, status, verified, wpm);

CREATE INDEX idx_sessions_player_started ON sessions (player_id, started_at);
CREATE INDEX idx_sessions_ip_started ON sessions (ip_hash, started_at);
CREATE INDEX idx_players_ip_created ON players (ip_hash, created_at);
