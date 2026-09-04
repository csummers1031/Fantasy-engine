# Fantasy Engine Build Plan

Multi-league autonomous fantasy football draft engine and live strategy war room.

## Stack

| Layer | Choice | Reason |
| --- | --- | --- |
| Framework | Next.js 15 App Router, React 19, TypeScript strict | Server actions plus route handlers in one deployable unit |
| Styling | Tailwind CSS 3.4, shadcn-style primitives on Radix | Dense trading-desk grid with consistent tokens |
| Icons | lucide-react | Requested |
| Automation | playwright-core with persistent user data dir and dynamic remote debugging port | No browser download during Vercel builds; cookies and MFA handled in an open viewport |
| Persistence | File-backed JSON tables with atomic writes and AES-256-GCM credential encryption | Zero native binaries, works in any Node runtime, falls back to the OS temp dir on read-only hosts |
| Streaming | Server-Sent Events route (`/api/stream`) driven by an in-process event bus | WebSocket upgrades are not supported by Next.js route handlers on Vercel; SSE delivers the same push contract |
| Tests | Vitest for engine, parsers, store, selectors | Fast, no browser dependency |

## Directory layout

```
src/app                 App Router pages, layouts, route handlers, server actions
src/app/api             REST route handlers (leagues, runners, providers, stream, sandbox, browser)
src/components/ui       shadcn-style primitives
src/components/war-room Live analytics grid panels
src/components/layout   Shell, sidebar, top bar
src/lib/types           Domain types shared by engine, integrations, UI
src/lib/errors          AppError, Result, isolate helpers
src/lib/db              JSON table store, table registry, crypto
src/lib/integrations    sleeper, espn, yahoo clients and mappers
src/lib/engine          snake indexing, VBD, tiers, run prediction, autopilot decision
src/lib/data            Embedded ADP curves and player pool
src/lib/sandbox         Offline bot draft simulator and stress tests
src/lib/automation      Browser launcher, self-healing selectors, co-pilot and autopilot runners, runner manager
src/lib/events          Event bus feeding the SSE stream
tests                   Vitest suites
```

## Engine contracts

1. `computeSnakeOrder(teams, rounds)` and `picksUntilUserTurn(currentPick, userSlot, teams)` give exact pick indexes for any snake draft.
2. `computeVbd(players, leagueSettings)` derives replacement levels from roster positions and team count, then ranks by value over replacement.
3. `detectTiers(players)` clusters projections per position with a gap threshold, and `tierFalloff` estimates how many tier members survive until the user's next pick.
4. `predictRuns(state)` scans opponents between the user's slot and next turn, flags roster deficits, and emits sniping alerts when a thin tier collides with hungry opponents.
5. `decideAutopilotPick(state, policy)` selects a player when the clock crosses the safety buffer, respecting a user queue first, then VBD with roster need weighting.

## Automation contracts

1. Co-pilot mode polls provider APIs or page frames every 2000 ms, publishes `draft.snapshot` events, and never clicks.
2. Autopilot mode watches the draft clock, and once the remaining time crosses the safety buffer with no manual pick it resolves the target row using self-healing selector chains, scrolls it into view, and clicks the draft action.
3. Selector failure raises a `selector.failure` event, triggers an audible and visual alert, and demotes the runner back to co-pilot mode.

## Verification protocol

1. `npm run typecheck` (tsc strict, no unchecked index access).
2. `npm run test` (Vitest suites for engine, integrations, store, selectors, simulator).
3. `npm run build` (Next.js production build).
4. Smoke test route handlers against `next start`.

## Deployment protocol

1. Commit on `claude/fantasy-football-draft-engine-qrto1y` and push to `csummers1031/Fantasy-engine`.
2. Link the repository to a Vercel project in the Hacking Demand team and trigger a deployment.
3. Record the live URL in the terminal log and in `docs/DEPLOYMENT.md`.
