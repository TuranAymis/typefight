# Publishing TypeFight on CrazyGames

Requirements below were checked on 2026-10-16 against the official pages linked in each section.
Portals change their rules: re-check the links before submitting.

## Decision: CrazyGames, not Poki

| Question                      | CrazyGames                                                         | Poki                                                                                               |
| ----------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Screen format                 | Landscape on desktop, resizable, portrait allowed                  | Must fill a 16:9 canvas (640x360, 836x470 or 1031x580). TypeFight is a responsive text UI         |
| Our live backend (duels, board) | Not restricted                                                   | Blocks all external requests by default; multiplayer needs an exemption and a privacy statement    |
| SDK scope to start            | "Basic Launch" needs the gameplay start event only                 | SDK required, plus staged Player Fit / Web Fit tests                                               |

CrazyGames fits the game as it is. Poki would need a layout rework and an exemption request, so it
stays a later option. Sources: <https://docs.crazygames.com/requirements/technical>,
<https://developers.poki.com/guide/requirements-quality>.

## Requirement checklist (CrazyGames)

| Requirement                                                              | Status | Where                                                                    |
| ------------------------------------------------------------------------ | ------ | ------------------------------------------------------------------------ |
| Total size <= 250 MB, <= 1500 files                                      | done   | `npm run build:crazygames` checks it (current build: 3 files, 0.26 MB)   |
| Initial download <= 50 MB (<= 20 MB for the mobile homepage)             | done   | same check, limit 20 MB                                                  |
| Relative paths only                                                      | done   | Vite `base: './'` in portal mode; the check rejects `/...` and external URLs |
| SDK v2 script in `index.html`                                            | done   | injected only into the portal build, exactly once (checked)              |
| `gameplayStart` when the player starts playing, `gameplayStop` otherwise | done   | `usePortalGameplay` in Simulator, Duel fight and the tutorial; never twice in a row |
| Loading start/stop (optional)                                            | done   | `portal.loadingStart()` before render, `loadingStop()` on the first screen |
| `happytime` on a special moment (use sparingly)                          | done   | duel victory only                                                        |
| Only ads served through the SDK                                          | done   | the game has no ads of its own; the web build's ad slot (`VITE_AD_PLACEHOLDERS`, AdSense ids and our own app ads) is forced off in this build; SDK ads are not wired in (optional later) |
| No third-party scripts or fonts besides the SDK                          | done   | Google Fonts link removed in the portal build (system font fallback); Cloudflare beacon is skipped there |
| Mobile: no text selection                                                | done   | `html[data-portal] body { user-select: none }`, inputs excluded          |
| Prevent page scroll on space/arrow keys                                  | partly | space is prevented by the typing surfaces; the game never uses arrow keys, so they can still scroll a page that overflows |
| Works in Chrome and Edge                                                 | to verify | manual test on both                                                   |
| Privacy policy when personal data is collected                           | draft  | `docs/privacy-policy-draft.md` (needs your review and a public URL)      |
| iOS: resume `AudioContext` on a touch                                    | done   | the sound player resumes a suspended context on every cue                |
| Smooth on a 4 GB Chromebook                                              | to verify | manual test if you have one                                           |

The SDK's Data and User modules are not used: players are identified by the game's own device token,
which the SDK does not replace.

## Building the upload

The portal build runs on CrazyGames' domain, so it must know where the API lives and the API must
allow that origin.

1. Deploy the API with the portal origin allowed (a `*` is never accepted):

   ```
   npx wrangler secret put ALLOWED_ORIGINS   # e.g. https://*.crazygames.com
   ```

   `https://*.crazygames.com` matches any subdomain on the default port. Use the exact origin the
   CrazyGames preview shows for your game if it is different.

2. Build and check:

   ```
   VITE_API_BASE=https://<your-api-host> npm run build:crazygames
   ```

   The build refuses to run without `VITE_API_BASE`. The output is `apps/web/dist-crazygames/`;
   the command prints the file count and sizes and fails if a limit or a rule is broken.

3. Zip the **contents** of `apps/web/dist-crazygames/` (so `index.html` is at the top of the zip) and
   upload it in the CrazyGames developer portal.

CI builds and checks the portal bundle on every push (`npm run build:crazygames`,
`npm run test:scripts`), and the `portal` Playwright project drives the built bundle with a stubbed SDK
and an API on another origin.

## Submission steps (done by you)

CrazyGames reviews a game in two stages: **Basic Launch** (the build is on the site, only the
gameplay start event is needed) and, if players stay, **Full Launch** (full SDK). This build already
meets the Full Launch SDK items.

- [ ] Create the developer account and a game entry in the CrazyGames developer portal
- [ ] Fill in title, description, tags, thumbnails/screenshots and the video if asked
- [ ] Publish the privacy policy at a public URL and link it (see the draft)
- [ ] Set `ALLOWED_ORIGINS` and deploy the API (step 1), apply migrations `0006` and `0007`
- [ ] Upload the zip from step 3, open the preview, play a duel and check the browser console for
      CORS errors (if there are any, the preview origin is missing from `ALLOWED_ORIGINS`)
- [ ] Test Chrome and Edge, and a phone

## Known limits

- IndexedDB is how the game remembers the player. Some browsers (for example Safari) block storage
  for pages inside another site's iframe. Then the game still plays, but the player has to pick a
  nickname again on every visit and analytics sends nothing (no stable device id). Watch the first
  CrazyGames reports for this.
- Only the SDK's ad formats are allowed. Rewarded or mid-game ads are not integrated; adding them
  later means calling `window.CrazyGames.SDK.ad.requestAd` at natural breaks (after a duel result).
