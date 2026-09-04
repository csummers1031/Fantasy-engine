import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { resetDataDirCache } from "@/lib/db/store";
import { GET as health } from "@/app/api/health/route";
import { POST as createLiveSandbox, GET as listLive } from "@/app/api/sandbox/live/route";
import { DELETE as destroyLive } from "@/app/api/sandbox/live/[id]/route";
import { POST as simulate } from "@/app/api/sandbox/simulate/route";
import { GET as leagueAnalysis } from "@/app/api/leagues/[id]/analysis/route";
import { GET as listRunners, POST as startRunnerRoute } from "@/app/api/runners/route";
import { POST as setMode } from "@/app/api/runners/[id]/mode/route";
import { DELETE as stopRunnerRoute } from "@/app/api/runners/[id]/route";
import { POST as saveCredentialRoute, GET as listCredentialsRoute } from "@/app/api/credentials/route";
import { GET as events } from "@/app/api/events/route";
import { POST as parseDom } from "@/app/api/yahoo/dom/parse/route";

interface Envelope<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

let dir = "";

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "fantasy-engine-api-"));
  process.env.FANTASY_ENGINE_DATA_DIR = dir;
  resetDataDirCache();
});

afterEach(async () => {
  resetDataDirCache();
  await fs.rm(dir, { recursive: true, force: true });
});

function jsonRequest(url: string, body: unknown, method: string = "POST"): Request {
  return new Request(`http://localhost${url}`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

async function read<T>(response: Response): Promise<Envelope<T>> {
  return (await response.json()) as Envelope<T>;
}

describe("route handlers", () => {
  it("reports health", async () => {
    const envelope = await read<{ status: string; version: string }>(await health());
    expect(envelope.ok).toBe(true);
    expect(envelope.data?.status).toBe("ok");
  });

  it("rejects invalid bodies with VALIDATION errors", async () => {
    const response = await simulate(jsonRequest("/api/sandbox/simulate", { simulations: 999 }));
    expect(response.status).toBe(400);
    const envelope = await read<unknown>(response);
    expect(envelope.error?.code).toBe("VALIDATION");
  });

  it("runs a stress test and records history", async () => {
    const response = await simulate(jsonRequest("/api/sandbox/simulate", { simulations: 2, config: { teams: 8, rounds: 5, userSlot: 2, pickTimerSeconds: 30, botDelayMinMs: 100, botDelayMaxMs: 200, seed: 1 } }));
    const envelope = await read<{ totalPicks: number; errors: number }>(response);
    expect(envelope.ok).toBe(true);
    expect(envelope.data?.totalPicks).toBe(80);
    expect(envelope.data?.errors).toBe(0);
  });

  it("creates a live sandbox with a runner, analyzes it, flips to autopilot, and tears down", async () => {
    const created = await read<{ sandboxId: string; league: { id: string }; runner: { id: string; policy: { mode: string } } | null }>(
      await createLiveSandbox(jsonRequest("/api/sandbox/live", { config: { teams: 6, rounds: 3, userSlot: 1, pickTimerSeconds: 30, botDelayMinMs: 50, botDelayMaxMs: 100, seed: 2 }, policy: { pollIntervalMs: 500 }, autoStartRunner: true })),
    );
    expect(created.ok).toBe(true);
    const sandboxId = created.data!.sandboxId;
    const leagueId = created.data!.league.id;
    const runnerId = created.data!.runner!.id;
    const live = await read<Array<{ id: string }>>(await listLive());
    expect(live.data?.some((entry) => entry.id === sandboxId)).toBe(true);
    const analysis = await read<{ snapshot: { picksUntilUserTurn: number; recommendations: unknown[] } | null; source: string }>(await leagueAnalysis(new Request(`http://localhost/api/leagues/${leagueId}/analysis`), { params: Promise.resolve({ id: leagueId }) }));
    expect(analysis.ok).toBe(true);
    expect(analysis.data?.snapshot?.recommendations.length).toBeGreaterThan(0);
    const mode = await read<{ policy: { mode: string } }>(await setMode(jsonRequest(`/api/runners/${runnerId}/mode`, { mode: "autopilot", reason: "test" }), { params: Promise.resolve({ id: runnerId }) }));
    expect(mode.data?.policy.mode).toBe("autopilot");
    const runners = await read<Array<{ id: string; live: boolean }>>(await listRunners());
    expect(runners.data?.find((runner) => runner.id === runnerId)?.live).toBe(true);
    const duplicate = await startRunnerRoute(jsonRequest("/api/runners", { leagueId }));
    expect(duplicate.status).toBe(409);
    const stopped = await read<{ status: string }>(await stopRunnerRoute(new Request("http://localhost"), { params: Promise.resolve({ id: runnerId }) }));
    expect(stopped.data?.status).toBe("stopped");
    const destroyed = await read<{ destroyed: boolean }>(await destroyLive(new Request("http://localhost"), { params: Promise.resolve({ id: sandboxId }) }));
    expect(destroyed.data?.destroyed).toBe(true);
    const history = await read<Array<{ type: string }>>(await events(new Request("http://localhost/api/events?limit=50")));
    expect(history.data?.some((event) => event.type === "runner.status")).toBe(true);
  });

  it("stores ESPN credentials via the credentials route", async () => {
    const saved = await read<{ provider: string }>(await saveCredentialRoute(jsonRequest("/api/credentials", { provider: "espn", swid: "{ABCDEFGH}", espnS2: "0123456789abcdef0123" })));
    expect(saved.data?.provider).toBe("espn");
    const listed = await read<Array<{ provider: string; masked: Record<string, string> }>>(await listCredentialsRoute());
    expect(listed.data?.[0]?.masked.swid).toMatch(/\*+/);
  });

  it("parses Yahoo DOM HTML through the route", async () => {
    const response = await parseDom(jsonRequest("/api/yahoo/dom/parse", { html: "<ul><li class='pick'><span class='player-name'>Ja'Marr Chase</span><span>CIN - WR</span></li></ul>", leagueKey: "k", teams: 10 }));
    const envelope = await read<{ snapshot: { picks: Array<{ playerName: string }> } }>(response);
    expect(envelope.data?.snapshot.picks[0]?.playerName).toBe("Ja'Marr Chase");
  });
});
