import { Table } from "./store";
import type {
  BrowserSessionRecord,
  CredentialRecord,
  LeagueRecord,
  RunnerRecord,
  SettingsRecord,
} from "@/lib/types";

export interface DraftSnapshotRecord {
  id: string;
  leagueId: string;
  stateJson: string;
  capturedAt: number;
}

export interface SimulationRecord {
  id: string;
  label: string;
  teams: number;
  rounds: number;
  userSlot: number;
  durationMs: number;
  picksPerSecond: number;
  userRosterJson: string;
  createdAt: number;
  errors: number;
}

export const leaguesTable = new Table<LeagueRecord>("leagues");
export const credentialsTable = new Table<CredentialRecord>("credentials");
export const runnersTable = new Table<RunnerRecord>("runners");
export const browserSessionsTable = new Table<BrowserSessionRecord>("browser_sessions");
export const settingsTable = new Table<SettingsRecord>("settings");
export const snapshotsTable = new Table<DraftSnapshotRecord>("draft_snapshots");
export const simulationsTable = new Table<SimulationRecord>("simulations");
