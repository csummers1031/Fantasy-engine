import { leaguesTable, snapshotsTable } from "@/lib/db/tables";
import { newId } from "@/lib/db/store";
import { AppError } from "@/lib/errors";
import { analyzeDraft } from "@/lib/engine";
import { buildPlayerPool } from "@/lib/data/player-pool";
import { fetchDraftState, resolveSourceKind } from "@/lib/automation/sources";
import { findRunnerForLeague } from "@/lib/automation/manager";
import type { AnalysisSnapshot, DraftState, LeagueRecord, LeagueSettings, Provider, RunnerPolicy } from "@/lib/types";
import { DEFAULT_RUNNER_POLICY, DEFAULT_SCORING } from "@/lib/types";
import { normalizeYahooLeagueKey } from "@/lib/integrations/yahoo/client";

export const DEFAULT_LEAGUE_SETTINGS: LeagueSettings = {
  teams: 12,
  rounds: 15,
  rosterPositions: ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "K", "DEF", "BN", "BN", "BN", "BN", "BN", "BN"],
  scoring: DEFAULT_SCORING,
  draftType: "snake",
  pickTimerSeconds: 90,
};

export interface CreateLeagueInput {
  provider: Provider;
  externalLeagueId: string;
  name: string;
  season: number;
  draftId: string;
  userTeamId: string;
  settings?: LeagueSettings;
}

export interface SyncResult {
  league: LeagueRecord;
  state: DraftState | null;
  syncError: string;
}

export async function createLeague(input: CreateLeagueInput): Promise<SyncResult> {
  const externalLeagueId = input.provider === "yahoo" ? normalizeYahooLeagueKey(input.externalLeagueId) : input.externalLeagueId;
  const duplicates = await leaguesTable.where((row) => row.provider === input.provider && row.externalLeagueId === externalLeagueId);
  const now = Date.now();
  const league: LeagueRecord = {
    id: duplicates[0]?.id ?? newId("lg"),
    provider: input.provider,
    externalLeagueId,
    name: input.name !== "" ? input.name : `${input.provider} ${externalLeagueId}`,
    season: input.season,
    draftId: input.draftId,
    userTeamId: input.userTeamId,
    settings: input.settings ?? duplicates[0]?.settings ?? DEFAULT_LEAGUE_SETTINGS,
    createdAt: duplicates[0]?.createdAt ?? now,
    updatedAt: now,
    lastSyncAt: 0,
    lastSyncError: "",
  };
  await leaguesTable.upsert(league);
  return syncLeague(league.id);
}

export async function syncLeague(leagueId: string): Promise<SyncResult> {
  const league = await leaguesTable.require(leagueId);
  try {
    const state = await fetchDraftState(league, resolveSourceKind(league), null);
    const updated: LeagueRecord = {
      ...league,
      draftId: state.draftId || league.draftId,
      userTeamId: state.userTeamId || league.userTeamId,
      settings: state.settings,
      lastSyncAt: Date.now(),
      lastSyncError: "",
      updatedAt: Date.now(),
    };
    await leaguesTable.upsert(updated);
    await snapshotsTable.upsert({ id: `snap_${league.id}`, leagueId: league.id, stateJson: JSON.stringify(state), capturedAt: Date.now() });
    return { league: updated, state, syncError: "" };
  } catch (error) {
    const appError = AppError.from(error);
    const updated: LeagueRecord = { ...league, lastSyncError: appError.message, updatedAt: Date.now() };
    await leaguesTable.upsert(updated);
    return { league: updated, state: null, syncError: appError.message };
  }
}

export async function loadCachedState(leagueId: string): Promise<DraftState | null> {
  const snapshot = await snapshotsTable.get(`snap_${leagueId}`);
  if (!snapshot) {
    return null;
  }
  try {
    return JSON.parse(snapshot.stateJson) as DraftState;
  } catch {
    return null;
  }
}

export interface AnalysisResult {
  league: LeagueRecord;
  snapshot: AnalysisSnapshot | null;
  state: DraftState | null;
  source: "runner" | "sync" | "cache" | "none";
  error: string;
}

export async function analysisForLeague(leagueId: string, policy: RunnerPolicy = DEFAULT_RUNNER_POLICY, forceSync: boolean = false): Promise<AnalysisResult> {
  const league = await leaguesTable.require(leagueId);
  const runner = findRunnerForLeague(leagueId);
  if (runner && runner.snapshot && !forceSync) {
    return { league, snapshot: runner.snapshot, state: runner.state, source: "runner", error: "" };
  }
  const synced = await syncLeague(leagueId);
  const now = Date.now();
  if (synced.state) {
    const snapshot = analyzeDraft({ state: synced.state, playerPool: buildPlayerPool(synced.state.settings.scoring), policy, now });
    return { league: synced.league, snapshot, state: synced.state, source: "sync", error: "" };
  }
  const cached = await loadCachedState(leagueId);
  if (cached) {
    const snapshot = analyzeDraft({ state: cached, playerPool: buildPlayerPool(cached.settings.scoring), policy, now });
    return { league: synced.league, snapshot, state: cached, source: "cache", error: synced.syncError };
  }
  return { league: synced.league, snapshot: null, state: null, source: "none", error: synced.syncError };
}

export async function listLeagues(): Promise<LeagueRecord[]> {
  const rows = await leaguesTable.all();
  return rows.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteLeague(leagueId: string): Promise<boolean> {
  const runner = findRunnerForLeague(leagueId);
  if (runner) {
    await runner.stop();
  }
  await snapshotsTable.remove(`snap_${leagueId}`);
  return leaguesTable.remove(leagueId);
}
