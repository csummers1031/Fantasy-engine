import type { DraftState, Player, Position, RunnerPolicy } from "./domain";

export interface ReplacementLevels {
  byPosition: Record<Position, number>;
  startersByPosition: Record<Position, number>;
}

export interface ValuedPlayer extends Player {
  vbd: number;
  positionalRank: number;
  overallRank: number;
  tier: number;
  replacementPoints: number;
  adpDelta: number;
}

export interface TierSummary {
  position: Position;
  tier: number;
  remaining: ValuedPlayer[];
  projectedSurvivors: number;
  falloffToNextTier: number;
  survivalProbability: number;
}

export interface OpponentNeed {
  teamId: string;
  teamName: string;
  slot: number;
  picksBeforeUser: number;
  deficits: Position[];
  likelyTargets: Position[];
}

export type AlertSeverity = "info" | "warning" | "critical";

export interface RunAlert {
  id: string;
  position: Position;
  severity: AlertSeverity;
  message: string;
  opponentsHungry: number;
  premiumRemaining: number;
  tier: number;
  createdAt: number;
  playersAtRisk: string[];
}

export interface Recommendation {
  player: ValuedPlayer;
  score: number;
  reasons: string[];
  needWeight: number;
  scarcityWeight: number;
}

export interface RosterNeed {
  position: Position;
  startersRequired: number;
  startersFilled: number;
  benchDepth: number;
  need: number;
}

export interface AnalysisSnapshot {
  leagueId: string;
  generatedAt: number;
  userTeamResolved: boolean;
  currentPickOverall: number;
  userNextPickOverall: number;
  picksUntilUserTurn: number;
  onClockTeamName: string;
  secondsRemaining: number;
  available: ValuedPlayer[];
  recommendations: Recommendation[];
  tiers: TierSummary[];
  opponentNeeds: OpponentNeed[];
  runAlerts: RunAlert[];
  userRoster: ValuedPlayer[];
  rosterNeeds: RosterNeed[];
}

export interface AutopilotDecision {
  shouldAct: boolean;
  player: ValuedPlayer | null;
  reason: string;
  secondsRemaining: number;
  bufferSeconds: number;
}

export interface AnalysisInput {
  state: DraftState;
  playerPool: Player[];
  policy: RunnerPolicy;
  now: number;
}
