import { buildPlayerPool } from "@/lib/data/player-pool";
import { runnersTable } from "@/lib/db/tables";
import { analyzeDraft, decideAutopilotPick } from "@/lib/engine";
import { AppError } from "@/lib/errors";
import { notice, publish } from "@/lib/events/bus";
import { findLiveSandbox } from "@/lib/sandbox/registry";
import type { AnalysisSnapshot, DraftState, LeagueRecord, RunnerMode, RunnerPolicy, RunnerRecord, RunnerStatus } from "@/lib/types";
import { executeDraftClick } from "./actions";
import { getLiveSessionForProvider } from "./browser";
import { fetchDraftState, type SourceKind } from "./sources";

export interface RunnerOptions {
  source: SourceKind;
}

export class DraftRunner {
  record: RunnerRecord;
  readonly league: LeagueRecord;
  readonly source: SourceKind;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;
  private ticking = false;
  private lastState: DraftState | null = null;
  private lastSnapshot: AnalysisSnapshot | null = null;
  private lastPickCount = -1;
  private manualPickOverall = -1;
  private actedOverall = -1;
  private consecutiveErrors = 0;
  private readonly seenAlertIds = new Set<string>();

  constructor(record: RunnerRecord, league: LeagueRecord, options: RunnerOptions) {
    this.record = record;
    this.league = league;
    this.source = options.source;
  }

  get id(): string {
    return this.record.id;
  }

  get snapshot(): AnalysisSnapshot | null {
    return this.lastSnapshot;
  }

  get state(): DraftState | null {
    return this.lastState;
  }

  async start(): Promise<void> {
    this.stopped = false;
    await this.setStatus("starting");
    this.record.startedAt = Date.now();
    await this.setStatus("running");
    this.schedule(0);
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.record.stoppedAt = Date.now();
    await this.setStatus("stopped");
  }

  async setMode(mode: RunnerMode, reason: string): Promise<void> {
    if (this.record.policy.mode === mode) {
      return;
    }
    this.record.policy = { ...this.record.policy, mode };
    if (mode === "autopilot") {
      this.record.degradedReason = "";
      if (this.record.status === "degraded") {
        this.record.status = "running";
      }
    }
    await this.persist();
    publish({ type: "runner.mode", runnerId: this.id, mode, reason, at: Date.now() });
  }

  async updatePolicy(policy: Partial<RunnerPolicy>): Promise<void> {
    const mode = policy.mode ?? this.record.policy.mode;
    this.record.policy = { ...this.record.policy, ...policy, mode };
    await this.persist();
    publish({ type: "runner.status", runner: this.record, at: Date.now() });
  }

  registerManualPick(): void {
    const overall = this.lastState ? this.lastState.clock.currentPickOverall : -1;
    this.manualPickOverall = overall;
  }

  private schedule(delayMs: number): void {
    if (this.stopped) {
      return;
    }
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      void this.tick();
    }, delayMs);
  }

  private async setStatus(status: RunnerStatus): Promise<void> {
    this.record.status = status;
    await this.persist();
    publish({ type: "runner.status", runner: this.record, at: Date.now() });
  }

  private async persist(): Promise<void> {
    try {
      await runnersTable.upsert(this.record);
    } catch {
      // persistence failures must not stop the live loop
    }
  }

  private async tick(): Promise<void> {
    if (this.stopped || this.ticking) {
      return;
    }
    this.ticking = true;
    const now = Date.now();
    try {
      const state = await fetchDraftState(this.league, this.source, this.lastState);
      this.consecutiveErrors = 0;
      this.record.lastError = "";
      this.record.lastTickAt = now;
      this.record.tickCount += 1;
      this.lastState = state;
      const pool = state.provider === "sleeper" && this.source === "sandbox" ? findLiveSandbox(this.league.externalLeagueId)?.pool ?? buildPlayerPool(state.settings.scoring) : buildPlayerPool(state.settings.scoring);
      const analysis = analyzeDraft({ state, playerPool: pool, policy: this.record.policy, now });
      this.lastSnapshot = analysis;
      if (state.picks.length !== this.lastPickCount) {
        if (this.lastPickCount >= 0) {
          const newPicks = state.picks.slice(this.lastPickCount);
          for (const pick of newPicks) {
            const team = state.teams.find((candidate) => candidate.id === pick.teamId);
            publish({ type: "draft.pick", leagueId: this.league.id, overall: pick.overall, playerName: pick.playerName, teamName: team ? team.name : pick.teamId, at: now });
          }
        }
        this.lastPickCount = state.picks.length;
      }
      publish({ type: "draft.snapshot", leagueId: this.league.id, snapshot: analysis, at: now });
      for (const alert of analysis.runAlerts) {
        if (!this.seenAlertIds.has(alert.id)) {
          this.seenAlertIds.add(alert.id);
          publish({ type: "run.alert", leagueId: this.league.id, alert, at: now });
        }
      }
      if (this.seenAlertIds.size > 500) {
        this.seenAlertIds.clear();
      }
      await this.maybeAutopilot(state, analysis, now);
      if (state.status === "complete") {
        notice("info", `Draft ${this.league.name} is complete. Runner stopping.`, false);
        await this.stop();
        return;
      }
      if (this.record.status === "starting") {
        await this.setStatus("running");
      } else {
        await this.persist();
      }
    } catch (error) {
      const appError = AppError.from(error);
      this.consecutiveErrors += 1;
      this.record.lastError = appError.message;
      if (appError.code === "SELECTOR_FAILURE") {
        await this.demote(appError);
      } else if (this.consecutiveErrors >= 5 && this.record.status !== "error") {
        await this.setStatus("error");
        notice("warning", `Runner for ${this.league.name} hit ${this.consecutiveErrors} consecutive errors: ${appError.message}`, false);
      } else {
        await this.persist();
      }
    } finally {
      this.ticking = false;
      const interval = this.record.status === "error" ? Math.min(30000, this.record.policy.pollIntervalMs * 4) : this.record.policy.pollIntervalMs;
      this.schedule(interval);
    }
  }

  private async maybeAutopilot(state: DraftState, analysis: AnalysisSnapshot, now: number): Promise<void> {
    const isUserOnClock = state.userTeamId !== "" && state.clock.onClockTeamId === state.userTeamId && state.status === "drafting";
    const overall = state.clock.currentPickOverall;
    const sandbox = this.source === "sandbox" ? findLiveSandbox(this.league.externalLeagueId) : null;
    const manualPickMade = this.manualPickOverall === overall || this.actedOverall === overall || (sandbox ? sandbox.hasManualPickThisTurn() : false);
    const decision = decideAutopilotPick({
      now,
      pickDeadlineAt: state.clock.pickDeadlineAt,
      isUserOnClock,
      manualPickMade,
      policy: this.record.policy,
      recommendations: analysis.recommendations,
      available: analysis.available,
    });
    if (!decision.shouldAct || !decision.player) {
      return;
    }
    this.actedOverall = overall;
    const player = decision.player;
    try {
      if (sandbox) {
        sandbox.makeUserPick(player.id, now);
        this.record.actionCount += 1;
        publish({ type: "autopilot.action", runnerId: this.id, leagueId: this.league.id, playerName: player.name, success: true, detail: `${decision.reason} (sandbox)`, at: now });
        return;
      }
      const session = getLiveSessionForProvider(this.league.provider);
      if (!session) {
        throw new AppError("SELECTOR_FAILURE", `No open browser session for ${this.league.provider}; cannot execute autopilot pick`, { details: { attempted: [] } });
      }
      const result = await executeDraftClick(session.page, player.name);
      this.record.actionCount += 1;
      publish({ type: "autopilot.action", runnerId: this.id, leagueId: this.league.id, playerName: player.name, success: result.success, detail: `${decision.reason}. ${result.detail}`, at: Date.now() });
      notice("info", `Autopilot drafted ${player.name} (${player.position}) with ${decision.secondsRemaining.toFixed(1)}s left.`, true);
    } catch (error) {
      const appError = AppError.from(error, "SELECTOR_FAILURE");
      publish({ type: "autopilot.action", runnerId: this.id, leagueId: this.league.id, playerName: player.name, success: false, detail: appError.message, at: Date.now() });
      throw appError;
    }
  }

  private async demote(error: AppError): Promise<void> {
    const attempted = Array.isArray(error.details.attempted) ? (error.details.attempted as string[]) : [];
    this.record.degradedReason = error.message;
    this.record.policy = { ...this.record.policy, mode: "copilot" };
    this.record.status = "degraded";
    await this.persist();
    publish({ type: "selector.failure", runnerId: this.id, provider: this.league.provider, attempted, message: error.message, at: Date.now() });
    publish({ type: "runner.mode", runnerId: this.id, mode: "copilot", reason: `Self-healing fallback: ${error.message}`, at: Date.now() });
    publish({ type: "runner.status", runner: this.record, at: Date.now() });
    notice("critical", `Autopilot disabled for ${this.league.name}: ${error.message}. Draft manually now.`, true);
  }
}
