# Production monitoring and release runbook

## Post-deploy smoke test

Run from the repository root with Node 20 or newer, against the deployed staging or production origins (not the Vite development server). Replace the example URLs with the matching environment's API and Pages/custom-domain URLs:

```sh
npm run smoke -- --api https://api.example.com --web https://typefight.example.com
```

To also check the protected metrics endpoint:

```sh
npm run smoke -- --api https://api.example.com --web https://typefight.example.com --admin-token "$METRICS_TOKEN"
```

The token must match the Worker's `METRICS_TOKEN` secret. Use a masked CI secret; do not paste it into tickets or committed files. PowerShell uses `$env:METRICS_TOKEN` for the environment variable.

The script checks HTML/root, a referenced JS asset, both health routes, cross-origin preflight and response headers, player creation, solo scoring, ghost/bot duel submission, leaderboard, persisted profile, and one anonymous analytics event. Metrics are checked only with the optional token. Same-origin deployments do not need CORS headers, so those checks are omitted. Cross-origin deployments must include the exact web origin in `ALLOWED_ORIGINS`.

Each executed step prints PASS/FAIL and milliseconds, followed by a summary. The first failure stops the run, exits 1, and prevents dependent requests; complete success exits 0. Requests are sequential, have a 15-second timeout, and are not retried. Each typing submission waits its actual short duration. This checks API acceptance of partial runs and a recorded duel outcome; it does not exercise browser rendering, keyboard input, glitch timing, or a full passage playthrough.

Each successful run creates one player named `smoke-` plus ten hexadecimal characters, two submitted sessions, one duel, and one anonymous `game_open` event. Treat these as disposable but real database records. There is no cleanup endpoint or smoke exclusion in metrics. Verified runs can enter leaderboards/ghost pools, award badges, and change ratings, including a real ghost owner's rating. The anonymous event cannot be joined to the nickname. Use staging for repeated investigation; run production smoke once per deployment. Do not run this as a frequent uptime probe. Player creation is limited to 10 per IP per hour; session starts to 20 per player and 60 per IP per ten minutes. On 429, stop and respect `Retry-After` rather than retrying in a loop. No automated deletion is performed.

## What to watch

| Surface         | Signals and first checks                                                                                                                                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Workers         | Request volume, errors/exceptions, 5xx responses, CPU time and latency where available. Compare to the pre-deploy baseline and identify the failing route/version. Separate expected 4xx validation errors and rate limits from server failures. |
| D1              | Read/write usage, database size, query latency/errors and remaining account limits. Check the production `DB` binding and migrations if `/health/db` fails. Frequent health checks also consume reads.                                           |
| Pages           | Deployment/build status, production domain availability, TLS, HTML and asset responses. A 200 HTML fallback at a missing JS URL is a failure, not a healthy asset.                                                                               |
| Product metrics | Active clients, event counts, D1/D7 retention, completed duels per player and rematch rate. Compare equivalent UTC windows and cohort sizes; these are product signals, not uptime indicators.                                                   |

Read `GET /api/admin/metrics?days=30` with `Authorization: Bearer <METRICS_TOKEN>`. Without the configured secret the route returns 404; a wrong token returns 401. The default window is 30 days, clamped to 1–90 days. Admin routes intentionally have no cross-origin access; use an operator CLI or server-side monitoring client.

Metrics come from anonymous `analytics_events`, not the sessions/duels tables. `retention.d1` and `.d7` contain `eligible`, `retained`, and `rate`: a client must open the game again exactly one or seven UTC dates after its first `game_open`; only mature cohorts whose first visit falls in the requested window are eligible. A rate of `null` means there is no denominator, not zero retention. `duels.perPlayer` is `duel_completed` events divided by distinct clients with that event; `duels.rematchRate` is `rematch` events divided by `duel_completed` events. They do not represent account-level participation or server-confirmed duel totals. Missing/duplicate client events, synthetic traffic and small cohorts affect interpretation. Review daily rather than polling this aggregate endpoint every minute.

## Alerts and uptime checks

Configure an external uptime checker for the deployed URLs:

- `GET <apiBase>/health`: HTTP 200 and JSON `status: "ok"` (Worker reachability).
- `GET <apiBase>/health/db`: HTTP 200, `status: "ok"`, `db: true` (a lightweight D1 read, not a write/migration check).
- `GET <webBase>/`: HTTP 200 HTML with the app root; periodically verify its referenced asset too.

A starting policy is one check every five minutes with notification after two consecutive failures and on recovery. Tune to the traffic, cost budget and incident response needs. For errors, start with a sustained increase over baseline (for example, over 1% 5xx for five minutes with a meaningful request count); use consecutive probe failures for low traffic instead of noisy percentages.

In Cloudflare Notifications, review and enable the available Worker error, usage/billing and Pages deployment failure notifications relevant to this account. Route actionable notices to the responsible operator and verify delivery. Availability, channels and thresholds vary by product and plan: do not assume a particular D1 quota or HTTP uptime alert exists. If the dashboard lacks a required alert, use external checks or scheduled metric review. Record configured thresholds and the incident owner in the team's operational notes. See [Cloudflare notification availability](https://developers.cloudflare.com/notifications/notification-available/) before configuring.

## Investigation

Record the failing step, UTC time, environment and deployed revision. Recheck health once, then inspect Workers analytics and live logs. From `apps/api`, using the repository's installed Wrangler:

```sh
npx wrangler tail --format pretty
npx wrangler tail --env staging --format pretty
```

The first command uses the top-level production Worker configuration; the second targets staging. Reproduce the failed request while tailing. Live tail is not historical evidence and may be sampled; consult available stored logs/analytics for earlier incidents. Avoid retaining device tokens, session tokens or authorization headers in incident artifacts. See [Wrangler commands](https://developers.cloudflare.com/workers/wrangler/commands/workers/) for options.

## Rollback

1. Pause further releases and identify the last known-good Worker version and Pages production deployment. Check API/client compatibility and D1 migration compatibility before switching versions.
2. In `apps/api`, inspect versions and deployments, then roll back to an explicitly selected known-good version:

   ```sh
   npx wrangler versions list
   npx wrangler deployments list
   npx wrangler rollback <VERSION_ID>
   ```

   Add `--env staging` to target staging. Alternatively use the Worker's deployment controls in the dashboard. A rollback creates a new active deployment of the selected version. See [Workers rollbacks](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/).

3. For Pages, open the project's Deployments and roll back to a successful known-good production deployment. Preview deployments are not production rollback targets. See [Pages rollbacks](https://developers.cloudflare.com/pages/configuration/rollbacks/).
4. Code rollback does not undo D1 writes or schema migrations. If the previous code cannot use the current schema, resolve that compatibility issue with a reviewed forward fix or a separate database recovery plan; do not blindly reverse migrations.
5. Run the smoke test against the restored pair, check error trends and record the outcome.

## Pre-release checklist and future CI step

- Run format, lint, typecheck, unit tests and `npm run test:scripts`.
- Confirm production/staging bindings, migrations, API base URL, allowed web origins and optional metrics secret. Record known-good deployment IDs.
- Deploy to staging and run the smoke test against its deployed URLs.
- Verify alert recipients and uptime checks; confirm rollback compatibility.
- After production API and Pages deployments complete, run the smoke command once against the production pair, inspect its summary, then review error trends.

For a future production smoke job, add a post-deploy step using Node 20+, dependent on successful API and web deployments. Invoke the command above with environment-specific URLs and optionally the masked metrics secret, preserve the step output as release evidence, and fail the job on a nonzero exit. Serialize production runs to avoid duplicate synthetic records and rate-limit pressure. Do not automatically loop retries or roll back on a single transient failure; investigate first. This task documents the step only and does not change workflows.
