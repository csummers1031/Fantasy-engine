# Deployment

## Verification log

| Gate | Result |
| --- | --- |
| `npm run typecheck` | pass, strict mode with `noUncheckedIndexedAccess` |
| `npm run test` | 48 tests across 9 suites pass |
| `npm run build` | pass, all routes compiled, lint clean |
| Smoke: pages | `/`, `/leagues/*`, `/sandbox`, `/settings`, `/war-room`, `/war-room/{id}` return 200 |
| Smoke: live sandbox | 8-team 4-round draft completed, autopilot made 4 picks, runner auto-stopped |
| Smoke: browser | Headless Chromium launched with `--remote-debugging-port`, DevTools `/json/version` reachable, cookies extracted, session closed |
| Smoke: stress | 20 simulations, 3600 picks, 0 errors, p95 decision latency under 2 ms |

## Vercel

The Vercel deployment serves the analytics UI, provider readers, sandbox, and SSE stream. Browser automation is unavailable on serverless hosts; the UI reports this and autopilot stays disabled there. Run the app locally for draft-day automation.

Environment variables to set on the Vercel project:

| Variable | Purpose |
| --- | --- |
| `CREDENTIAL_ENCRYPTION_KEY` | Required. Long random passphrase for credential encryption. Without it the app uses a development fallback and flags it on the settings page. |
| `SLEEPER_API_BASE`, `ESPN_API_BASE`, `YAHOO_API_BASE` | Optional upstream overrides. |
| `YAHOO_CONSUMER_KEY`, `YAHOO_CONSUMER_SECRET`, `YAHOO_REDIRECT_URI` | Optional defaults for the Yahoo OAuth flow. |

Storage on Vercel falls back to `/tmp`, which is ephemeral per function instance. Persistent league configuration should be done on the local runtime.

## Live deployment record

| Item | Value |
| --- | --- |
| Repository | https://github.com/csummers1031/Fantasy-engine |
| Branch | `claude/fantasy-football-draft-engine-qrto1y` (production branch on Vercel) |
| Vercel team | Hacking Demand (`team_zBVDcTeJRlw0cA9DLFF07vna`) |
| Vercel project | `fantasy-engine` (`prj_Oywu0ROFu4xRXbMzQLsVRVNKNQMs`) |
| Production URL | https://fantasy-engine-ten.vercel.app |
| Team alias | https://fantasy-engine-hacking-demand.vercel.app |
| Inspector | https://vercel.com/hacking-demand/fantasy-engine |
| First green deployment | `dpl_CG1R56VByhP1jaGKpYgii69afPMb` from commit `e19317a` |
| Live check | `GET /api/health` returned 200, `/sandbox` server-rendered 200 |

The first deployment (`dpl_SyZcjLDrKG8CEuqDqYxQWVFW6UA2`) failed with `module_not_found` because the unanchored `data/` ignore rule excluded `src/lib/data`. The rule is now anchored to the repository root.

Deployment protection: the team default has Vercel Authentication enabled for all deployments except custom domains, so visitors must sign in to Vercel unless a custom domain is attached or the setting is changed in the project's Deployment Protection page. `CREDENTIAL_ENCRYPTION_KEY` is not yet set on the project; the health endpoint reports the fallback key until it is added.
