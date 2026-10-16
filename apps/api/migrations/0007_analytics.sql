-- Anonymous product analytics. client_id is a random id made on the device (not linked to a
-- nickname or player). day is the UTC date of the server clock, so retention never trusts the client.
-- props holds only schema-validated enum values (see packages/texts analyticsEvents).
CREATE TABLE analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id TEXT NOT NULL,
  name TEXT NOT NULL,
  day TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  props TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_analytics_name_day ON analytics_events (name, day);
CREATE INDEX idx_analytics_client_day ON analytics_events (client_id, day);
CREATE INDEX idx_analytics_client_time ON analytics_events (client_id, created_at);
