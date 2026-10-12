-- Duel flow: a duel session remembers its ghost; duels remember rating changes.

ALTER TABLE sessions ADD COLUMN ghost_session_id TEXT REFERENCES sessions (id);

ALTER TABLE duels ADD COLUMN opponent_is_bot INTEGER NOT NULL DEFAULT 0 CHECK (opponent_is_bot IN (0, 1));
ALTER TABLE duels ADD COLUMN reason TEXT;
ALTER TABLE duels ADD COLUMN rating_before INTEGER;
ALTER TABLE duels ADD COLUMN rating_after INTEGER;
ALTER TABLE duels ADD COLUMN opponent_rating_before INTEGER;
ALTER TABLE duels ADD COLUMN opponent_rating_after INTEGER;

-- Ghost lookup by player rating, and the "last 10 opponents" exclusion.
CREATE INDEX idx_players_rating ON players (is_bot, rating);
CREATE INDEX idx_sessions_text ON sessions (lang, text_id, status, verified);
