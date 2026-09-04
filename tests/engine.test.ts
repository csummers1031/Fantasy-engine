import { describe, expect, it } from "vitest";
import { buildPlayerPool } from "@/lib/data/player-pool";
import { analyzeDraft, assignTiers, computeReplacementLevels, computeRosterNeeds, computeVbd, decideAutopilotPick, predictRuns, summarizeTiers } from "@/lib/engine";
import { DEFAULT_RUNNER_POLICY, DEFAULT_SCORING } from "@/lib/types";
import type { DraftPick, DraftState, LeagueSettings } from "@/lib/types";
import { coordinatesForOverall } from "@/lib/engine/snake";

const settings: LeagueSettings = {
  teams: 12,
  rounds: 15,
  rosterPositions: ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "K", "DEF", "BN", "BN", "BN", "BN", "BN", "BN"],
  scoring: DEFAULT_SCORING,
  draftType: "snake",
  pickTimerSeconds: 90,
};

function buildState(picks: DraftPick[], userSlot: number = 5, now: number = 1_000_000): DraftState {
  const teams = Array.from({ length: settings.teams }, (_, index) => ({ id: `t${index + 1}`, name: `Team ${index + 1}`, slot: index + 1, ownerName: "", isUser: index + 1 === userSlot }));
  const currentPickOverall = picks.length + 1;
  const coordinates = coordinatesForOverall(currentPickOverall, settings.teams);
  return {
    provider: "sleeper",
    leagueId: "league",
    draftId: "draft",
    status: "drafting",
    settings,
    teams,
    picks,
    clock: { currentPickOverall, onClockTeamId: `t${coordinates.slot}`, pickStartedAt: now, pickDeadlineAt: now + 90000, secondsPerPick: 90 },
    userTeamId: `t${userSlot}`,
    updatedAt: now,
  };
}

function pickFromPool(pool: ReturnType<typeof buildPlayerPool>, overall: number, playerIndex: number, teams: number = 12): DraftPick {
  const player = pool[playerIndex];
  if (!player) {
    throw new Error("missing player");
  }
  const coordinates = coordinatesForOverall(overall, teams);
  return { overall, round: coordinates.round, pickInRound: coordinates.pickInRound, slot: coordinates.slot, teamId: `t${coordinates.slot}`, playerId: player.id, playerName: player.name, position: player.position, timestamp: 0 };
}

describe("player pool", () => {
  it("builds a pool with unique ids and monotone projections within positions", () => {
    const pool = buildPlayerPool();
    expect(pool.length).toBeGreaterThan(200);
    expect(new Set(pool.map((player) => player.id)).size).toBe(pool.length);
    const rbs = pool.filter((player) => player.position === "RB");
    for (let index = 1; index < rbs.length; index += 1) {
      expect(rbs[index - 1]!.projectedPoints).toBeGreaterThanOrEqual(rbs[index]!.projectedPoints);
    }
  });

  it("raises WR projections under full PPR relative to standard", () => {
    const standard = buildPlayerPool({ ...DEFAULT_SCORING, reception: 0 });
    const ppr = buildPlayerPool({ ...DEFAULT_SCORING, reception: 1 });
    const wrStandard = standard.find((player) => player.id === "jamarr-chase");
    const wrPpr = ppr.find((player) => player.id === "jamarr-chase");
    expect(wrPpr!.projectedPoints).toBeGreaterThan(wrStandard!.projectedPoints);
  });
});

describe("value over replacement", () => {
  it("computes replacement levels that scale with roster slots", () => {
    const pool = buildPlayerPool();
    const levels = computeReplacementLevels(pool, settings);
    expect(levels.startersByPosition.RB).toBeGreaterThanOrEqual(24);
    expect(levels.startersByPosition.QB).toBe(12);
    const superflex = computeReplacementLevels(pool, { ...settings, rosterPositions: [...settings.rosterPositions, "SUPER_FLEX"] });
    expect(superflex.startersByPosition.QB).toBeGreaterThan(levels.startersByPosition.QB);
  });

  it("ranks players and assigns positional ranks and tiers", () => {
    const pool = buildPlayerPool();
    const valued = computeVbd(pool, settings);
    expect(valued[0]?.overallRank).toBe(1);
    const qb1 = valued.find((player) => player.position === "QB" && player.positionalRank === 1);
    expect(qb1).toBeDefined();
    expect(qb1!.tier).toBe(1);
    expect(valued.every((player) => player.tier >= 1)).toBe(true);
  });
});

describe("tiers", () => {
  it("splits tiers at large gaps and caps tier size", () => {
    const tiers = assignTiers([
      { id: "a", points: 300 },
      { id: "b", points: 298 },
      { id: "c", points: 260 },
      { id: "d", points: 258 },
    ]);
    expect(tiers.get("a")).toBe(1);
    expect(tiers.get("b")).toBe(1);
    expect(tiers.get("c")).toBe(2);
    expect(tiers.get("d")).toBe(2);
    const large = assignTiers(Array.from({ length: 10 }, (_, index) => ({ id: String(index), points: 200 - index * 0.5 })));
    expect(large.get("6")).toBe(2);
  });

  it("estimates survival probability that falls with more picks before the user", () => {
    const pool = buildPlayerPool();
    const valued = computeVbd(pool, settings);
    const soon = summarizeTiers(valued, 1, 2);
    const late = summarizeTiers(valued, 1, 20);
    const soonRb = soon.find((tier) => tier.position === "RB" && tier.tier === 1);
    const lateRb = late.find((tier) => tier.position === "RB" && tier.tier === 1);
    expect(soonRb!.survivalProbability).toBeGreaterThan(lateRb!.survivalProbability);
  });
});

describe("run prediction", () => {
  it("fires a TE alert when opponents lack a TE and only a couple of premium options remain", () => {
    const fullPool = buildPlayerPool();
    const topTes = fullPool.filter((player) => player.position === "TE").slice(0, 2);
    const pool = [...fullPool.filter((player) => player.position !== "TE"), ...topTes];
    const nonTe = pool.map((player, index) => (player.position !== "TE" ? index : -1)).filter((index) => index >= 0);
    const picks: DraftPick[] = [];
    for (let overall = 1; overall <= 8; overall += 1) {
      picks.push(pickFromPool(pool, overall, nonTe[overall - 1]!));
    }
    const state = buildState(picks, 5);
    const valued = computeVbd(pool, settings);
    const taken = new Set(picks.map((pick) => pick.playerId));
    const available = valued.filter((player) => !taken.has(player.id));
    const alerts = predictRuns(state, available, 0);
    const te = alerts.find((alert) => alert.position === "TE");
    expect(te).toBeDefined();
    expect(te!.premiumRemaining).toBeLessThanOrEqual(2);
    expect(te!.opponentsHungry).toBeGreaterThanOrEqual(te!.premiumRemaining);
    expect(te!.severity).toBe("critical");
    expect(te!.playersAtRisk.length).toBeGreaterThan(0);
  });
});

describe("analysis and autopilot", () => {
  it("produces a full snapshot with recommendations and roster needs", () => {
    const pool = buildPlayerPool();
    const picks = [pickFromPool(pool, 1, 0), pickFromPool(pool, 2, 1), pickFromPool(pool, 3, 2), pickFromPool(pool, 4, 3)];
    const state = buildState(picks, 5);
    const snapshot = analyzeDraft({ state, playerPool: pool, policy: DEFAULT_RUNNER_POLICY, now: 1_000_000 });
    expect(snapshot.picksUntilUserTurn).toBe(0);
    expect(snapshot.recommendations.length).toBeGreaterThan(5);
    expect(snapshot.available.some((player) => player.id === pool[0]!.id)).toBe(false);
    expect(snapshot.rosterNeeds.find((need) => need.position === "RB")!.startersRequired).toBe(2);
    const kicker = snapshot.recommendations.find((recommendation) => recommendation.player.position === "K");
    expect(kicker).toBeUndefined();
    const needs = computeRosterNeeds(picks, "t5", settings);
    expect(needs.find((need) => need.position === "QB")!.need).toBeGreaterThan(0);
  });

  it("waits for the buffer and then picks from the queue before value", () => {
    const pool = buildPlayerPool();
    const state = buildState([], 1);
    const now = 1_000_000;
    const snapshot = analyzeDraft({ state, playerPool: pool, policy: { ...DEFAULT_RUNNER_POLICY, mode: "autopilot", queue: ["brock-bowers"] }, now });
    const early = decideAutopilotPick({ now, pickDeadlineAt: now + 60000, isUserOnClock: true, manualPickMade: false, policy: { ...DEFAULT_RUNNER_POLICY, mode: "autopilot", queue: ["brock-bowers"] }, recommendations: snapshot.recommendations, available: snapshot.available });
    expect(early.shouldAct).toBe(false);
    const late = decideAutopilotPick({ now, pickDeadlineAt: now + 10000, isUserOnClock: true, manualPickMade: false, policy: { ...DEFAULT_RUNNER_POLICY, mode: "autopilot", queue: ["brock-bowers"] }, recommendations: snapshot.recommendations, available: snapshot.available });
    expect(late.shouldAct).toBe(true);
    expect(late.player?.id).toBe("brock-bowers");
    const manual = decideAutopilotPick({ now, pickDeadlineAt: now + 10000, isUserOnClock: true, manualPickMade: true, policy: { ...DEFAULT_RUNNER_POLICY, mode: "autopilot" }, recommendations: snapshot.recommendations, available: snapshot.available });
    expect(manual.shouldAct).toBe(false);
    const copilot = decideAutopilotPick({ now, pickDeadlineAt: now + 1000, isUserOnClock: true, manualPickMade: false, policy: DEFAULT_RUNNER_POLICY, recommendations: snapshot.recommendations, available: snapshot.available });
    expect(copilot.shouldAct).toBe(false);
  });

  it("falls back to top recommendation when queue is empty and respects avoid list", () => {
    const pool = buildPlayerPool();
    const state = buildState([], 1);
    const now = 1_000_000;
    const policy = { ...DEFAULT_RUNNER_POLICY, mode: "autopilot" as const, avoidPlayerIds: [pool[0]!.id] };
    const snapshot = analyzeDraft({ state, playerPool: pool, policy, now });
    const decision = decideAutopilotPick({ now, pickDeadlineAt: now + 5000, isUserOnClock: true, manualPickMade: false, policy, recommendations: snapshot.recommendations, available: snapshot.available });
    expect(decision.shouldAct).toBe(true);
    expect(decision.player?.id).not.toBe(pool[0]!.id);
  });
});
