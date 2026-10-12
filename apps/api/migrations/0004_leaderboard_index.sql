-- Leaderboard: verified submitted runs per language within a time window.
CREATE INDEX idx_sessions_board ON sessions (lang, status, verified, submitted_at);
