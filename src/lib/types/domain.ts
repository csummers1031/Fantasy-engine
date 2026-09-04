export type Provider = "sleeper" | "espn" | "yahoo";

export type Position = "QB" | "RB" | "WR" | "TE" | "K" | "DEF";

export const POSITIONS: readonly Position[] = ["QB", "RB", "WR", "TE", "K", "DEF"] as const;

export type RosterSlot =
  | Position
  | "FLEX"
  | "SUPER_FLEX"
  | "REC_FLEX"
  | "BN"
  | "IR"
  | "IDP_FLEX"
  | "DL"
  | "LB"
  | "DB";

export const FLEX_ELIGIBILITY: Readonly<Record<string, readonly Position[]>> = {
  FLEX: ["RB", "WR", "TE"],
  SUPER_FLEX: ["QB", "RB", "WR", "TE"],
  REC_FLEX: ["WR", "TE"],
};

export interface ScoringSettings {
  passingYardsPerPoint: number;
  passingTd: number;
  interception: number;
  rushingYardsPerPoint: number;
  rushingTd: number;
  receivingYardsPerPoint: number;
  receivingTd: number;
  reception: number;
  tePremium: number;
  fumbleLost: number;
}

export const DEFAULT_SCORING: ScoringSettings = {
  passingYardsPerPoint: 25,
  passingTd: 4,
  interception: -2,
  rushingYardsPerPoint: 10,
  rushingTd: 6,
  receivingYardsPerPoint: 10,
  receivingTd: 6,
  reception: 1,
  tePremium: 0,
  fumbleLost: -2,
};

export interface LeagueSettings {
  teams: number;
  rounds: number;
  rosterPositions: RosterSlot[];
  scoring: ScoringSettings;
  draftType: "snake" | "linear" | "auction";
  pickTimerSeconds: number;
}

export interface Player {
  id: string;
  name: string;
  position: Position;
  team: string;
  adp: number;
  projectedPoints: number;
  byeWeek: number;
  age: number;
  injuryStatus: "healthy" | "questionable" | "doubtful" | "out" | "ir";
  providerIds: Partial<Record<Provider, string>>;
}

export interface DraftPick {
  overall: number;
  round: number;
  pickInRound: number;
  slot: number;
  teamId: string;
  playerId: string;
  playerName: string;
  position: Position;
  timestamp: number;
}

export interface DraftTeam {
  id: string;
  name: string;
  slot: number;
  ownerName: string;
  isUser: boolean;
}

export type DraftStatus = "pre_draft" | "drafting" | "paused" | "complete";

export interface DraftClock {
  currentPickOverall: number;
  onClockTeamId: string;
  pickStartedAt: number;
  pickDeadlineAt: number;
  secondsPerPick: number;
}

export interface DraftState {
  provider: Provider;
  leagueId: string;
  draftId: string;
  status: DraftStatus;
  settings: LeagueSettings;
  teams: DraftTeam[];
  picks: DraftPick[];
  clock: DraftClock;
  userTeamId: string;
  updatedAt: number;
}

export interface LeagueRecord {
  id: string;
  provider: Provider;
  externalLeagueId: string;
  name: string;
  season: number;
  draftId: string;
  userTeamId: string;
  settings: LeagueSettings;
  createdAt: number;
  updatedAt: number;
  lastSyncAt: number;
  lastSyncError: string;
}

export interface CredentialRecord {
  id: string;
  provider: Provider;
  label: string;
  encryptedPayload: string;
  createdAt: number;
  updatedAt: number;
}

export interface SleeperCredentialPayload {
  username: string;
  userId: string;
}

export interface EspnCredentialPayload {
  swid: string;
  espnS2: string;
}

export interface YahooCredentialPayload {
  consumerKey: string;
  consumerSecret: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export type CredentialPayload =
  | { provider: "sleeper"; data: SleeperCredentialPayload }
  | { provider: "espn"; data: EspnCredentialPayload }
  | { provider: "yahoo"; data: YahooCredentialPayload };

export type RunnerMode = "copilot" | "autopilot";

export type RunnerStatus = "idle" | "starting" | "running" | "degraded" | "stopped" | "error";

export interface RunnerPolicy {
  mode: RunnerMode;
  pollIntervalMs: number;
  safeTimeBufferSeconds: number;
  queue: string[];
  positionCaps: Partial<Record<Position, number>>;
  avoidPlayerIds: string[];
  preferQueueOverValue: boolean;
}

export const DEFAULT_RUNNER_POLICY: RunnerPolicy = {
  mode: "copilot",
  pollIntervalMs: 2000,
  safeTimeBufferSeconds: 15,
  queue: [],
  positionCaps: { QB: 2, TE: 2, K: 1, DEF: 1 },
  avoidPlayerIds: [],
  preferQueueOverValue: true,
};

export interface RunnerRecord {
  id: string;
  leagueId: string;
  provider: Provider;
  status: RunnerStatus;
  policy: RunnerPolicy;
  lastTickAt: number;
  lastError: string;
  tickCount: number;
  actionCount: number;
  degradedReason: string;
  startedAt: number;
  stoppedAt: number;
}

export interface BrowserSessionRecord {
  id: string;
  provider: Provider;
  profileDir: string;
  remoteDebuggingPort: number;
  startedAt: number;
  status: "launching" | "open" | "closed" | "error";
  lastError: string;
  targetUrl: string;
}

export interface SettingsRecord {
  id: "global";
  audioAlerts: boolean;
  defaultSafeBufferSeconds: number;
  defaultPollIntervalMs: number;
  theme: "dark";
  updatedAt: number;
}

export const DEFAULT_SETTINGS: SettingsRecord = {
  id: "global",
  audioAlerts: true,
  defaultSafeBufferSeconds: 15,
  defaultPollIntervalMs: 2000,
  theme: "dark",
  updatedAt: 0,
};
