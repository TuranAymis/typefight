# @typefight/api

Cloudflare Worker + Hono API.

Run locally with `npm run dev -w @typefight/api`. The `GET /health` endpoint returns `{ "status": "ok" }`.

The `DB` binding connects the Worker to the `typefight-db` D1 database. `GET /health/db` checks the connection with `SELECT 1 AS ok` and returns `{ "status": "ok", "db": true }` when it succeeds.

`GET /api/profile/:id` includes `cursorEffect` (default: `default`). `PUT /api/player/cursor-effect` accepts `{ "effectId": "pulse" }` with the player's device token as a Bearer token. It returns `{ "effectId": "pulse" }`, rejects unknown effects with 400 and locked effects with 403, and limits each authenticated player to 20 attempts per ten minutes (429 with `Retry-After`). Migration `0006_cursor_effect.sql` adds the saved selection and write-budget table; apply it before deploying this endpoint.

## Analytics

`POST /api/events` takes `{ "clientId": "<32 hex>", "events": [{ "name": "game_open" }, { "name": "sim_started", "props": { "lang": "en" } }] }` (at most 20 events, 4 KB). The events and their properties are fixed in `packages/texts/src/analyticsEvents.ts`: `game_open`, `sim_started`, `sim_completed`, `duel_started`, `duel_completed`, `rematch`, `glitch_fired`. Properties are enums only, the whole batch is rejected with 400 if one event is outside the schema, and a device may write 600 events an hour (429). The server stamps every event with its own UTC clock. No IP address, nickname or typed text is stored; `clientId` is a random id made in the browser and not linked to a player. Migration `0007_analytics.sql` adds the table; apply it before deploying.

`GET /api/admin/metrics?days=30` (1-90) returns event counts, active clients, D1 and D7 retention, duels per player and rematch rate. It needs `Authorization: Bearer <METRICS_TOKEN>` and does not exist (404) until the secret is set: `npx wrangler secret put METRICS_TOKEN`. D1 retention is the share of visitors who open the game again exactly one day after their first visit (D7: seven days), counted only over visitors old enough to have had the chance. Duels per player is `duel_completed` events divided by the devices that completed one; rematch rate is `rematch` divided by `duel_completed`.

The web app sends events only when the player has not enabled Do Not Track or Global Privacy Control. To also load Cloudflare Web Analytics, build the web app with `VITE_CF_BEACON_TOKEN=<32-char site token>`; without it no third-party script is loaded.

Local `wrangler dev` uses a local D1 simulator. To check the remote database manually, run `npx wrangler d1 execute typefight-db --remote --command "SELECT 1"`.
