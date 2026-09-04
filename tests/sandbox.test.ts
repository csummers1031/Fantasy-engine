import { describe, expect, it } from "vitest";
import { SandboxDraft, runOfflineDraft, runStressTest, seededRandom } from "@/lib/sandbox/simulator";
import { DEFAULT_RUNNER_POLICY } from "@/lib/types";

describe("sandbox simulator", () => {
  it("produces deterministic randomness for a seed", () => {
    const a = seededRandom(7);
    const b = seededRandom(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("runs a full offline draft with the user drafted by the engine", () => {
    const { draft, errors } = runOfflineDraft({ teams: 10, rounds: 8, userSlot: 3, seed: 11 }, { ...DEFAULT_RUNNER_POLICY, mode: "autopilot" });
    expect(errors).toBe(0);
    expect(draft.isComplete).toBe(true);
    expect(draft.picks).toHaveLength(80);
    const userPicks = draft.picks.filter((pick) => pick.teamId === draft.userTeamId);
    expect(userPicks).toHaveLength(8);
    expect(new Set(draft.picks.map((pick) => pick.playerId)).size).toBe(80);
  });

  it("enforces clock ownership and manual pick tracking", () => {
    const draft = new SandboxDraft("sb", { teams: 8, rounds: 2, userSlot: 1, seed: 3 }, 0);
    expect(draft.isUserOnClock()).toBe(true);
    expect(() => draft.makeBotPick(1)).toThrow();
    const available = draft.available();
    const pick = draft.makeUserPick(available[0]!.id, 1);
    expect(pick.overall).toBe(1);
    expect(draft.isUserOnClock()).toBe(false);
    expect(() => draft.makeUserPick(available[1]!.id, 2)).toThrow();
    draft.makeBotPick(2);
    expect(draft.state(3).clock.currentPickOverall).toBe(3);
  });

  it("expires the clock into an autopilot pick for the user", () => {
    const draft = new SandboxDraft("sb2", { teams: 6, rounds: 2, userSlot: 1, pickTimerSeconds: 10, seed: 5 }, 0);
    expect(draft.expireClock(5000)).toBeNull();
    const pick = draft.expireClock(11000, { ...DEFAULT_RUNNER_POLICY, mode: "autopilot" });
    expect(pick?.teamId).toBe(draft.userTeamId);
  });

  it("stress tests multiple drafts and reports throughput", () => {
    const result = runStressTest(3, { teams: 12, rounds: 6, userSlot: 7, seed: 99 }, { ...DEFAULT_RUNNER_POLICY, mode: "autopilot" });
    expect(result.simulations).toBe(3);
    expect(result.totalPicks).toBe(216);
    expect(result.errors).toBe(0);
    expect(result.picksPerSecond).toBeGreaterThan(0);
    expect(result.userRosters).toHaveLength(3);
    expect(result.analysisLatencyMs.p95).toBeGreaterThanOrEqual(result.analysisLatencyMs.p50);
  });
});

describe("live sandbox bots", () => {
  it("reschedules bots automatically after a user pick when live", async () => {
    const draft = new SandboxDraft("live", { teams: 4, rounds: 2, userSlot: 1, botDelayMinMs: 10, botDelayMaxMs: 20, seed: 1 });
    draft.startLiveBots();
    expect(draft.isLive).toBe(true);
    draft.makeUserPick(draft.available()[0]!.id);
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(draft.picks.length).toBeGreaterThanOrEqual(5);
    expect(draft.isUserOnClock() || draft.isComplete).toBe(true);
    draft.stopLiveBots();
  });
});

describe("sandbox platform auto pick and replay", () => {
  it("auto drafts by ADP when the clock expires in co-pilot mode and replays picks", () => {
    const draft = new SandboxDraft("replay", { teams: 6, rounds: 2, userSlot: 1, pickTimerSeconds: 10, seed: 9 }, 0);
    const bestAdp = draft.available()[0]!;
    const pick = draft.expireClock(11000, DEFAULT_RUNNER_POLICY);
    expect(pick?.playerId).toBe(bestAdp.id);
    draft.makeBotPick(12000);
    draft.makeBotPick(13000);
    const copy = new SandboxDraft("replay-2", { teams: 6, rounds: 2, userSlot: 1, pickTimerSeconds: 10, seed: 9 }, 0);
    const applied = copy.replay(draft.picks.map((entry) => ({ teamId: entry.teamId, playerId: entry.playerId, timestamp: entry.timestamp })));
    expect(applied).toBe(3);
    expect(copy.state(0).clock.currentPickOverall).toBe(4);
    copy.resetClock(50000);
    expect(copy.state(50000).clock.pickDeadlineAt).toBe(60000);
  });
});
