# Fantasy Engine

Multi-league autonomous fantasy football draft engine and live strategy war room. Next.js App Router, TypeScript strict, Tailwind, shadcn-style primitives, Playwright automation, file-backed JSON tables with encrypted credentials.

## Capabilities

- Sleeper, ESPN, and Yahoo pipelines with provider-specific clients, mappers, and layout screens.
- Snake pick indexing, value over replacement (VBD) from league roster slots and scoring, tier detection with survival probabilities, predictive run and sniping alerts, and roster-need weighted recommendations.
- Co-pilot mode polls every 2000 ms (configurable) and streams analysis to the war room over Server-Sent Events.
- Autopilot mode watches the clock and, when the safe buffer is crossed without a manual pick, resolves the player row with self-healing selector chains, scrolls to it, and clicks the draft action in the persistent Chromium session.
- Selector failure demotes the runner to co-pilot instantly and fires an audible plus visual alert.
- Sandbox simulation matrix with embedded ADP curves for offline stress tests and a live sandbox draft that exercises the full runner loop.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. Browser automation (persistent profile, dynamic `--remote-debugging-port`) only works on a local Node runtime with a Chromium binary. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` if auto-detection fails.

## Verify

```bash
npm run typecheck
npm run test
npm run build
```

## Provider setup

| Provider | Credential | Source of truth |
| --- | --- | --- |
| Sleeper | Username (public reads) | `GET /league/{league_id}`, `GET /draft/{draft_id}/picks` |
| ESPN | `SWID` and `espn_s2` cookies, pasted or extracted from the browser session | `.../seasons/{season}/segments/0/leagues/{league_id}?view=mDraftDetail&view=mSettings&view=mRoster` |
| Yahoo | Consumer key and secret, OAuth 2.0 authorization code flow | `/league/{league_key}/draftresults`, DOM tree fallback from the browser session |

## API surface

- `GET /api/health`
- `GET|POST /api/leagues`, `GET|PATCH|DELETE /api/leagues/{id}`, `POST /api/leagues/{id}/sync`, `GET /api/leagues/{id}/analysis`
- `GET /api/sleeper/league/{leagueId}`, `GET /api/sleeper/draft/{draftId}/picks?slot=`, `GET /api/sleeper/user/{username}`
- `GET /api/espn/league/{leagueId}?season=`
- `GET /api/yahoo/oauth/authorize`, `GET /api/yahoo/oauth/callback`, `POST /api/yahoo/oauth/token`, `POST /api/yahoo/dom/parse`
- `GET|POST /api/runners`, `GET|DELETE /api/runners/{id}`, `POST /api/runners/{id}/mode`, `PATCH /api/runners/{id}/policy`, `POST /api/runners/{id}/manual-pick`
- `GET /api/stream` (SSE), `GET /api/events`
- `GET /api/browser/sessions`, `POST /api/browser/launch`, `POST /api/browser/cookies`, `POST|DELETE /api/browser/sessions/{id}`
- `GET|POST /api/sandbox/simulate`, `GET|POST /api/sandbox/live`, `GET|DELETE /api/sandbox/live/{id}`, `POST /api/sandbox/live/{id}/pick`
- `GET|POST|PUT /api/credentials`, `DELETE /api/credentials/{id}`, `GET|PATCH /api/settings`

## Storage

JSON tables live in `FANTASY_ENGINE_DATA_DIR` (default `./data`). On read-only hosts the store falls back to the OS temp directory. Credentials are encrypted with AES-256-GCM using a key derived from `CREDENTIAL_ENCRYPTION_KEY`.
