-- Recovery code: only its SHA-256 hash is stored; the code is shown to the player once.
ALTER TABLE players ADD COLUMN recovery_hash TEXT;
CREATE UNIQUE INDEX idx_players_recovery ON players (recovery_hash) WHERE recovery_hash IS NOT NULL;

-- Failed/any recover attempts per hashed IP, for rate limiting.
CREATE TABLE recovery_attempts (
  ip_hash TEXT NOT NULL,
  attempted_at INTEGER NOT NULL
);
CREATE INDEX idx_recovery_attempts ON recovery_attempts (ip_hash, attempted_at);
