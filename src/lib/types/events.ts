import type { AnalysisSnapshot, RunAlert } from "./engine";
import type { RunnerMode, RunnerRecord, RunnerStatus, Provider } from "./domain";

export type EngineEvent =
  | { type: "draft.snapshot"; leagueId: string; snapshot: AnalysisSnapshot; at: number }
  | { type: "draft.pick"; leagueId: string; overall: number; playerName: string; teamName: string; at: number }
  | { type: "run.alert"; leagueId: string; alert: RunAlert; at: number }
  | { type: "runner.status"; runner: RunnerRecord; at: number }
  | { type: "runner.mode"; runnerId: string; mode: RunnerMode; reason: string; at: number }
  | { type: "autopilot.action"; runnerId: string; leagueId: string; playerName: string; success: boolean; detail: string; at: number }
  | { type: "selector.failure"; runnerId: string; provider: Provider; attempted: string[]; message: string; at: number }
  | { type: "browser.session"; sessionId: string; provider: Provider; port: number; status: string; at: number }
  | { type: "sandbox.progress"; simulationId: string; completedPicks: number; totalPicks: number; at: number }
  | { type: "sandbox.complete"; simulationId: string; durationMs: number; picksPerSecond: number; at: number }
  | { type: "system.notice"; level: "info" | "warning" | "critical"; message: string; audio: boolean; at: number }
  | { type: "heartbeat"; at: number };

export type EngineEventType = EngineEvent["type"];

export interface RunnerStatusChange {
  runnerId: string;
  previous: RunnerStatus;
  next: RunnerStatus;
}
