# @typefight/api

Cloudflare Worker + Hono API.

Run locally with `npm run dev -w @typefight/api`. The `GET /health` endpoint returns `{ "status": "ok" }`.

The `DB` binding connects the Worker to the `typefight-db` D1 database. `GET /health/db` checks the connection with `SELECT 1 AS ok` and returns `{ "status": "ok", "db": true }` when it succeeds.

Local `wrangler dev` uses a local D1 simulator. To check the remote database manually, run `npx wrangler d1 execute typefight-db --remote --command "SELECT 1"`.
