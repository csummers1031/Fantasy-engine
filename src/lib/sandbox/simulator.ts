import { buildPlayerPool } from "@/lib/data/player-pool";
import { expectedPickProbability } from "@/lib/data/adp-curves";
import { analyzeDraft, coordinatesForOverall, decideAutopilotPick, positionDeficits } from "@/lib/engine";
import type { DraftPick, DraftState, DraftTeam, LeagueSettings, Player, Position, RunnerPolicy, ValuedPlayer } from "@/lib/types";
import { DEFAULT_RUNNER_POLICY, DEFAULT_SCORING } from "@/lib/types";
import { AppError } from "@/lib/errors";

export interface SandboxConfig {
  teams: number;
  rounds: number;
  userSlot: number;
  pickTimerSeconds: number;
  botDelayMinMs: number;
  botDelayMaxMs: number;
  seed: number;
  scoring: LeagueSettings["scoring"];
  rosterPositions: LeagueSettings["rosterPositions"];
}

export const DEFAULT_SANDBOX_CONFIG: SandboxConfig = {
  teams: 12,
  rounds: 15,
  userSlot: 5,
  pickTimerSeconds: 60,
  botDelayMinMs: 1500,
  botDelayMaxMs: 6000,
  seed: 42,
  scoring: DEFAULT_SCORING,
  rosterPositions: ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "K", "DEF", "BN", "BN", "BN", "BN", "BN", "BN"],
};

export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildSandboxSettings(config: SandboxConfig): LeagueSettings {
  return {
    teams: config.teams,
    rounds: config.rounds,
    rosterPositions: config.rosterPositions,
    scoring: config.scoring,
    draftType: "snake",
    pickTimerSeconds: config.pickTimerSeconds,
  };
}

export function buildSandboxTeams(config: SandboxConfig): DraftTeam[] {
  const names = ["Gridiron Ghosts", "Blitz Brigade", "End Zone Elite", "Turf Titans", "Red Zone Raiders", "Pocket Rockets", "Hail Mary Heroes", "Sack Attack", "Fourth Down Fury", "Goal Line Giants", "Pylon Pirates", "Draft Day Dynasty", "Snap Count Syndicate", "Audible Army", "Two Minute Drill", "Shotgun Squad"];
  const teams: DraftTeam[] = [];
  for (let slot = 1; slot <= config.teams; slot += 1) {
    const isUser = slot === config.userSlot;
    teams.push({ id: `sb-team-${slot}`, name: isUser ? "You" : names[(slot - 1) % names.length] ?? `Bot ${slot}`, slot, ownerName: isUser ? "user" : `bot-${slot}`, isUser });
  }
  return teams;
}

export function botSelect(available: Player[], picks: DraftPick[], teamId: string, settings: LeagueSettings, overall: number, random: () => number): Player {
  const deficits = positionDeficits(picks, teamId, settings);
  const round = Math.ceil(overall / settings.teams);
  const lateRounds = round >= settings.rounds - 1;
  const teamCounts: Record<Position, number> = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0 };
  for (const pick of picks) {
    if (pick.teamId === teamId) {
      teamCounts[pick.position] += 1;
    }
  }
  let best: Player | null = null;
  let bestScore = -Infinity;
  for (const player of available.slice(0, 40)) {
    const probability = expectedPickProbability(player.adp, overall);
    let score = probability * 100 + (200 - Math.min(200, player.adp)) * 0.15;
    if (deficits.includes(player.position)) {
      score += 18;
    }
    if ((player.position === "K" || player.position === "DEF") && !lateRounds) {
      score -= 60;
    }
    if (player.position === "QB" && teamCounts.QB >= 1) {
      score -= 30;
    }
    if (player.position === "TE" && teamCounts.TE >= 1) {
      score -= 25;
    }
    score += random() * 22;
    if (score > bestScore) {
      bestScore = score;
      best = player;
    }
  }
  const chosen = best ?? available[0];
  if (!chosen) {
    throw new AppError("RUNNER_STATE", "Sandbox ran out of available players");
  }
  return chosen;
}

export class SandboxDraft {
  readonly id: string;
  readonly config: SandboxConfig;
  readonly settings: LeagueSettings;
  readonly teams: DraftTeam[];
  readonly pool: Player[];
  readonly picks: DraftPick[] = [];
  private readonly random: () => number;
  private currentOverall = 1;
  private pickStartedAt: number;
  private status: DraftState["status"] = "drafting";
  private botTimer: ReturnType<typeof setTimeout> | null = null;
  private manualPickThisTurn = false;
  private liveBots = false;
  private readonly listeners = new Set<(state: DraftState) => void>();

  constructor(id: string, config: Partial<SandboxConfig> = {}, now: number = Date.now()) {
    this.id = id;
    this.config = { ...DEFAULT_SANDBOX_CONFIG, ...config };
    if (this.config.userSlot < 1 || this.config.userSlot > this.config.teams) {
      throw new AppError("VALIDATION", "userSlot must be within the league size", { details: { userSlot: this.config.userSlot, teams: this.config.teams } });
    }
    this.settings = buildSandboxSettings(this.config);
    this.teams = buildSandboxTeams(this.config);
    this.pool = buildPlayerPool(this.config.scoring);
    this.random = seededRandom(this.config.seed);
    this.pickStartedAt = now;
  }

  get userTeamId(): string {
    return this.teams.find((team) => team.isUser)?.id ?? "";
  }

  get totalPicks(): number {
    return this.settings.teams * this.settings.rounds;
  }

  get isComplete(): boolean {
    return this.status === "complete";
  }

  onChange(listener: (state: DraftState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  available(): Player[] {
    const taken = new Set(this.picks.map((pick) => pick.playerId));
    return this.pool.filter((player) => !taken.has(player.id)).sort((a, b) => a.adp - b.adp);
  }

  onClockTeam(): DraftTeam {
    const coordinates = coordinatesForOverall(Math.min(this.currentOverall, this.totalPicks), this.settings.teams, "snake");
    const team = this.teams.find((candidate) => candidate.slot === coordinates.slot);
    if (!team) {
      throw new AppError("RUNNER_STATE", "Sandbox could not resolve the on-clock team");
    }
    return team;
  }

  isUserOnClock(): boolean {
    return !this.isComplete && this.onClockTeam().isUser;
  }

  state(now: number = Date.now()): DraftState {
    const onClock = this.isComplete ? null : this.onClockTeam();
    return {
      provider: "sleeper",
      leagueId: this.id,
      draftId: this.id,
      status: this.status,
      settings: this.settings,
      teams: this.teams,
      picks: [...this.picks],
      clock: {
        currentPickOverall: Math.min(this.currentOverall, this.totalPicks),
        onClockTeamId: onClock ? onClock.id : "",
        pickStartedAt: this.pickStartedAt,
        pickDeadlineAt: this.pickStartedAt + this.settings.pickTimerSeconds * 1000,
        secondsPerPick: this.settings.pickTimerSeconds,
      },
      userTeamId: this.userTeamId,
      updatedAt: now,
    };
  }

  private emit(): void {
    const snapshot = this.state();
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch {
        // listener isolation
      }
    }
  }

  makePick(teamId: string, playerId: string, now: number = Date.now()): DraftPick {
    if (this.isComplete) {
      throw new AppError("RUNNER_STATE", "Sandbox draft is complete");
    }
    const onClock = this.onClockTeam();
    if (onClock.id !== teamId) {
      throw new AppError("RUNNER_STATE", `Team ${teamId} is not on the clock`, { details: { onClock: onClock.id } });
    }
    const player = this.pool.find((candidate) => candidate.id === playerId);
    if (!player) {
      throw new AppError("NOT_FOUND", `Player ${playerId} is not in the sandbox pool`);
    }
    if (this.picks.some((pick) => pick.playerId === playerId)) {
      throw new AppError("VALIDATION", `${player.name} has already been drafted`);
    }
    const coordinates = coordinatesForOverall(this.currentOverall, this.settings.teams, "snake");
    const pick: DraftPick = {
      overall: this.currentOverall,
      round: coordinates.round,
      pickInRound: coordinates.pickInRound,
      slot: coordinates.slot,
      teamId,
      playerId,
      playerName: player.name,
      position: player.position,
      timestamp: now,
    };
    this.picks.push(pick);
    this.currentOverall += 1;
    this.pickStartedAt = now;
    this.manualPickThisTurn = false;
    if (this.currentOverall > this.totalPicks) {
      this.status = "complete";
    }
    this.emit();
    if (this.liveBots) {
      this.scheduleBots();
    }
    return pick;
  }

  makeUserPick(playerId: string, now: number = Date.now()): DraftPick {
    if (!this.isUserOnClock()) {
      throw new AppError("RUNNER_STATE", "User is not on the clock");
    }
    this.manualPickThisTurn = true;
    return this.makePick(this.userTeamId, playerId, now);
  }

  hasManualPickThisTurn(): boolean {
    return this.manualPickThisTurn;
  }

  resetClock(now: number = Date.now()): void {
    this.pickStartedAt = now;
  }

  platformAutoPick(now: number = Date.now()): DraftPick {
    const onClock = this.onClockTeam();
    const best = this.available()[0];
    if (!best) {
      throw new AppError("RUNNER_STATE", "No players remain for the platform auto pick");
    }
    return this.makePick(onClock.id, best.id, now);
  }

  replay(picks: ReadonlyArray<{ teamId: string; playerId: string; timestamp: number }>): number {
    let applied = 0;
    for (const pick of picks) {
      if (this.isComplete) {
        break;
      }
      const onClock = this.onClockTeam();
      if (onClock.id !== pick.teamId || this.picks.some((existing) => existing.playerId === pick.playerId)) {
        break;
      }
      this.makePick(pick.teamId, pick.playerId, pick.timestamp);
      applied += 1;
    }
    return applied;
  }

  makeBotPick(now: number = Date.now()): DraftPick {
    const onClock = this.onClockTeam();
    if (onClock.isUser) {
      throw new AppError("RUNNER_STATE", "Cannot bot-pick for the user team");
    }
    const player = botSelect(this.available(), this.picks, onClock.id, this.settings, this.currentOverall, this.random);
    return this.makePick(onClock.id, player.id, now);
  }

  autoPickForUser(policy: RunnerPolicy, now: number = Date.now()): DraftPick {
    const analysis = analyzeDraft({ state: this.state(now), playerPool: this.pool, policy: { ...policy, mode: "autopilot" }, now });
    const decision = decideAutopilotPick({
      now,
      pickDeadlineAt: now,
      isUserOnClock: true,
      manualPickMade: false,
      policy: { ...policy, mode: "autopilot" },
      recommendations: analysis.recommendations,
      available: analysis.available,
    });
    const player = decision.player ?? this.available()[0] ?? null;
    if (!player) {
      throw new AppError("RUNNER_STATE", "No player available for the user pick");
    }
    return this.makePick(this.userTeamId, player.id, now);
  }

  startLiveBots(): void {
    this.liveBots = true;
    this.scheduleBots();
  }

  get isLive(): boolean {
    return this.liveBots;
  }

  scheduleBots(): void {
    this.cancelBots();
    if (this.isComplete || this.isUserOnClock()) {
      return;
    }
    const spread = Math.max(0, this.config.botDelayMaxMs - this.config.botDelayMinMs);
    const delay = this.config.botDelayMinMs + Math.floor(this.random() * spread);
    this.botTimer = setTimeout(() => {
      this.botTimer = null;
      try {
        this.makeBotPick();
      } catch {
        // pick failures are surfaced by the runner through state comparison
      }
      this.scheduleBots();
    }, delay);
  }

  cancelBots(): void {
    if (this.botTimer) {
      clearTimeout(this.botTimer);
      this.botTimer = null;
    }
  }

  stopLiveBots(): void {
    this.liveBots = false;
    this.cancelBots();
  }

  expireClock(now: number = Date.now(), policy: RunnerPolicy = DEFAULT_RUNNER_POLICY): DraftPick | null {
    if (this.isComplete) {
      return null;
    }
    const deadline = this.pickStartedAt + this.settings.pickTimerSeconds * 1000;
    if (now < deadline) {
      return null;
    }
    if (this.isUserOnClock()) {
      return policy.mode === "autopilot" ? this.autoPickForUser(policy, now) : this.platformAutoPick(now);
    }
    return this.makeBotPick(now);
  }
}

export interface StressTestResult {
  simulations: number;
  totalPicks: number;
  durationMs: number;
  picksPerSecond: number;
  errors: number;
  userRosters: Array<{ simulation: number; roster: Array<{ name: string; position: Position; round: number; vbd: number }>; totalVbd: number }>;
  analysisLatencyMs: { p50: number; p95: number; max: number };
}

export function runOfflineDraft(config: Partial<SandboxConfig>, policy: RunnerPolicy, onProgress: (completed: number, total: number) => void = () => undefined): { draft: SandboxDraft; latencies: number[]; errors: number } {
  const draft = new SandboxDraft(`offline-${Date.now().toString(36)}`, config, 0);
  const latencies: number[] = [];
  let errors = 0;
  let clock = 1;
  while (!draft.isComplete) {
    clock += 1000;
    try {
      if (draft.isUserOnClock()) {
        const started = performance.now();
        draft.autoPickForUser(policy, clock);
        latencies.push(performance.now() - started);
      } else {
        draft.makeBotPick(clock);
      }
    } catch {
      errors += 1;
      if (errors > draft.totalPicks) {
        break;
      }
    }
    onProgress(draft.picks.length, draft.totalPicks);
  }
  return { draft, latencies, errors };
}

function percentile(values: number[], fraction: number): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor(fraction * (sorted.length - 1)));
  return Number((sorted[index] ?? 0).toFixed(2));
}

export function runStressTest(simulations: number, config: Partial<SandboxConfig>, policy: RunnerPolicy, onProgress: (completed: number, total: number) => void = () => undefined): StressTestResult {
  if (!Number.isInteger(simulations) || simulations < 1 || simulations > 200) {
    throw new AppError("VALIDATION", "simulations must be an integer between 1 and 200");
  }
  const started = performance.now();
  const latencies: number[] = [];
  let totalPicks = 0;
  let errors = 0;
  const userRosters: StressTestResult["userRosters"] = [];
  const teams = config.teams ?? DEFAULT_SANDBOX_CONFIG.teams;
  const rounds = config.rounds ?? DEFAULT_SANDBOX_CONFIG.rounds;
  const totalExpected = simulations * teams * rounds;
  for (let simulation = 1; simulation <= simulations; simulation += 1) {
    const seed = (config.seed ?? DEFAULT_SANDBOX_CONFIG.seed) + simulation * 7919;
    const result = runOfflineDraft({ ...config, seed }, policy, (completed) => onProgress(totalPicks + completed, totalExpected));
    totalPicks += result.draft.picks.length;
    errors += result.errors;
    latencies.push(...result.latencies);
    const finalState = result.draft.state(0);
    const analysis = analyzeDraft({ state: finalState, playerPool: result.draft.pool, policy, now: 0 });
    const valuedById = new Map<string, ValuedPlayer>(analysis.userRoster.map((player) => [player.id, player] as const));
    const roster = result.draft.picks
      .filter((pick) => pick.teamId === result.draft.userTeamId)
      .map((pick) => ({ name: pick.playerName, position: pick.position, round: pick.round, vbd: valuedById.get(pick.playerId)?.vbd ?? 0 }));
    userRosters.push({ simulation, roster, totalVbd: Number(roster.reduce((sum, entry) => sum + entry.vbd, 0).toFixed(1)) });
  }
  const durationMs = Math.max(1, performance.now() - started);
  return {
    simulations,
    totalPicks,
    durationMs: Number(durationMs.toFixed(1)),
    picksPerSecond: Number(((totalPicks / durationMs) * 1000).toFixed(1)),
    errors,
    userRosters,
    analysisLatencyMs: { p50: percentile(latencies, 0.5), p95: percentile(latencies, 0.95), max: percentile(latencies, 1) },
  };
}
