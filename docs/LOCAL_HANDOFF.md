# Local handoff: finish Yahoo and ESPN on the user's Mac

This session runs in the cloud and cannot reach the user's Mac or Chrome. The remaining work needs the machine that has the logged-in browser profile. Open Claude Code in a terminal inside this repository on that Mac and paste the prompt below.

## Prompt

Get the Fantasy Engine draft tool working for real leagues on this Mac before the Yahoo draft tonight, Tuesday Sep 8 at 6:00 PM CDT. The Yahoo Fantasy API is not available to this user's developer app (Yahoo returns invalid_scope), so Yahoo must work entirely through the browser page. ESPN works through cookies plus its read API.

Run `git pull` first, then `npm run dev` on port 3000 and keep it running.

Read first: `src/lib/automation/browser.ts` (persistent Chromium profile at `./.browser-profiles/<provider>`, the Yahoo profile is already logged in, `activePage()` picks the draft tab), `src/lib/automation/dom-snapshot.ts`, `src/lib/integrations/yahoo/dom-parser.ts` (heuristic, never run against real Yahoo markup, this is the main fix), `src/lib/automation/selectors.ts` and `actions.ts` (blind selector chains for player row and Draft button), `src/lib/automation/page-source.ts` and `sources.ts` (Yahoo reads the page when no API token exists), `src/lib/automation/runner.ts` and `manager.ts` (`POST /api/runners` with `source: "page"`), `src/lib/data/league-presets.ts` (exact preset for The Dudes, `nfl.l.305040`), `src/app/api/browser/snapshot/route.ts` (`POST { sessionId }` captures the active tab into `./data/dom-snapshots/`), `src/app/api/browser/launch/route.ts`, `src/app/api/browser/cookies/route.ts`. Delete the stale Yahoo OAuth credential row in `data/credentials.json` so the Yahoo source always uses the browser.

Part 1, Yahoo: launch the Yahoo session (`POST /api/browser/launch`, headless false), join a mock draft in that window, capture snapshots in the lobby, during picks, and on the clock. Rewrite `parseDraftDom` and friends in `dom-parser.ts` for the real markup (picks with round, pick number, team, player, position; clock; on-clock team; user team; available rows), keeping exported names. Add trimmed real fixtures to `tests/yahoo.test.ts`. Update `selectors.ts` so the real Yahoo row and Draft button come first with the generic selectors as fallbacks; adjust `executeDraftClick` for search or confirm steps if Yahoo needs them. Verify in the mock draft: start a page-source runner, confirm `GET /api/leagues/{id}/analysis` shows real picks, correct on-clock team, sensible clock, and a resolved user team; then flip to autopilot with a short buffer and confirm it clicks a player. Make sure the user's team resolves in the real league at `https://football.fantasysports.yahoo.com/f1/305040`.

Part 2, WoWDragons (`nfl.l.185796`): read its settings page in the Yahoo session and add a preset mirroring The Dudes; update the stored league settings.

Part 3, ESPN: launch the ESPN session, ask the user to log in if needed, extract cookies (`POST /api/browser/cookies`, save true), find the league id from the page, create the league via `POST /api/leagues`, and fix whatever in `src/lib/integrations/espn/` the real response breaks.

Part 4: `npm run typecheck && npm run test && npm run build` must pass. Commit and `git push -u origin claude/fantasy-football-draft-engine-qrto1y`. Leave the dev server and the Yahoo window open, and tell the user exactly what to do at 6:00 PM (open the draft room in that window, open the war room for The Dudes, start the runner, pick co-pilot or autopilot).

Constraints: never paste cookies, tokens, or secrets into chat or commits; `data/` stays gitignored; no pull requests; short plain replies without em dashes.
