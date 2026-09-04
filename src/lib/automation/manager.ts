import { leaguesTable, runnersTable } from "@/lib/db/tables";
import { newId } from "@/lib/db/store";
import { AppError } from "@/lib/errors";
import type { AnalysisSnapshot, LeagueRecord, RunnerMode, RunnerPolicy, RunnerRecord } from "@/lib/types";
import { DEFAULT_RUNNER_POLICY } from "@/lib/types";
import { DraftRunner } from "./runner";
import { resolveSourceKind, type SourceKind } from "./sources";

declare global {
  var __fantasyEngineRunners: Map<string, DraftRunner> | undefined;
}

function live(): Map<string, DraftRunner> {
  if (!globalThis.__fantasyEngineRunners) {
    globalThis.__fantasyEngineRunners = new Map();
  }
  return globalThis.__fantasyEngineRunners;
}

export async function startRunner(leagueId: string, policy: Partial<RunnerPolicy> = {}, sourceOverride: SourceKind | "" = ""): Promise<RunnerRecord> {
  const league = await leaguesTable.require(leagueId);
  const existing = [...live().values()].find((runner) => runner.league.id === leagueId);
  if (existing && existing.record.status !== "stopped") {
    throw new AppError("RUNNER_STATE", `A runner is already active for ${league.name}`, { details: { runnerId: existing.id } });
  }
  const stale = await runnersTable.where((row) => row.leagueId === leagueId);
  for (const row of stale) {
    if (row.status !== "stopped") {
      await runnersTable.upsert({ ...row, status: "stopped", stoppedAt: Date.now() });
    }
  }
  const record: RunnerRecord = {
    id: newId("run"),
    leagueId,
    provider: league.provider,
    status: "idle",
    policy: { ...DEFAULT_RUNNER_POLICY, ...policy, mode: policy.mode ?? "copilot" },
    lastTickAt: 0,
    lastError: "",
    tickCount: 0,
    actionCount: 0,
    degradedReason: "",
    startedAt: 0,
    stoppedAt: 0,
  };
  await runnersTable.upsert(record);
  const source = sourceOverride !== "" ? sourceOverride : resolveSourceKind(league);
  const runner = new DraftRunner(record, league, { source });
  live().set(record.id, runner);
  await runner.start();
  return runner.record;
}

export function getRunner(runnerId: string): DraftRunner {
  const runner = live().get(runnerId);
  if (!runner) {
    throw new AppError("NOT_FOUND", `Runner ${runnerId} is not active in this process`);
  }
  return runner;
}

export function findRunnerForLeague(leagueId: string): DraftRunner | null {
  return [...live().values()].find((runner) => runner.league.id === leagueId && runner.record.status !== "stopped") ?? null;
}

export async function stopRunner(runnerId: string): Promise<RunnerRecord> {
  const runner = live().get(runnerId);
  if (!runner) {
    const stored = await runnersTable.get(runnerId);
    if (!stored) {
      throw new AppError("NOT_FOUND", `Runner ${runnerId} not found`);
    }
    const updated = { ...stored, status: "stopped" as const, stoppedAt: Date.now() };
    await runnersTable.upsert(updated);
    return updated;
  }
  await runner.stop();
  live().delete(runnerId);
  return runner.record;
}

export async function setRunnerMode(runnerId: string, mode: RunnerMode, reason: string): Promise<RunnerRecord> {
  const runner = getRunner(runnerId);
  await runner.setMode(mode, reason);
  return runner.record;
}

export async function updateRunnerPolicy(runnerId: string, policy: Partial<RunnerPolicy>): Promise<RunnerRecord> {
  const runner = getRunner(runnerId);
  await runner.updatePolicy(policy);
  return runner.record;
}

export function registerManualPick(runnerId: string): RunnerRecord {
  const runner = getRunner(runnerId);
  runner.registerManualPick();
  return runner.record;
}

export async function listRunners(): Promise<Array<RunnerRecord & { live: boolean; source: SourceKind | "" }>> {
  const stored = await runnersTable.all();
  return stored
    .map((record) => {
      const runner = live().get(record.id);
      if (runner) {
        return { ...runner.record, live: true, source: runner.source };
      }
      const status = record.status === "stopped" || record.status === "error" ? record.status : ("stopped" as const);
      return { ...record, status, live: false, source: "" as const };
    })
    .sort((a, b) => b.startedAt - a.startedAt);
}

export function liveSnapshotForLeague(leagueId: string): { runner: RunnerRecord; snapshot: AnalysisSnapshot | null } | null {
  const runner = findRunnerForLeague(leagueId);
  if (!runner) {
    return null;
  }
  return { runner: runner.record, snapshot: runner.snapshot };
}

export function leagueForRunner(runnerId: string): LeagueRecord {
  return getRunner(runnerId).league;
}
