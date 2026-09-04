import type { AutopilotDecision, Recommendation, RunnerPolicy, ValuedPlayer } from "@/lib/types";

export interface AutopilotInput {
  now: number;
  pickDeadlineAt: number;
  isUserOnClock: boolean;
  manualPickMade: boolean;
  policy: RunnerPolicy;
  recommendations: Recommendation[];
  available: ValuedPlayer[];
}

export function secondsRemaining(now: number, deadlineAt: number): number {
  return Math.max(0, (deadlineAt - now) / 1000);
}

export function pickFromQueue(policy: RunnerPolicy, available: ValuedPlayer[]): ValuedPlayer | null {
  const availableById = new Map(available.map((player) => [player.id, player] as const));
  for (const id of policy.queue) {
    const player = availableById.get(id);
    if (player && !policy.avoidPlayerIds.includes(player.id)) {
      return player;
    }
  }
  return null;
}

export function decideAutopilotPick(input: AutopilotInput): AutopilotDecision {
  const remaining = secondsRemaining(input.now, input.pickDeadlineAt);
  const buffer = input.policy.safeTimeBufferSeconds;
  const base = { secondsRemaining: Number(remaining.toFixed(3)), bufferSeconds: buffer };
  if (input.policy.mode !== "autopilot") {
    return { ...base, shouldAct: false, player: null, reason: "Runner is in co-pilot mode" };
  }
  if (!input.isUserOnClock) {
    return { ...base, shouldAct: false, player: null, reason: "User is not on the clock" };
  }
  if (input.manualPickMade) {
    return { ...base, shouldAct: false, player: null, reason: "Manual pick already registered" };
  }
  if (remaining > buffer) {
    return { ...base, shouldAct: false, player: null, reason: `Waiting for buffer (${remaining.toFixed(1)}s remaining, acts at ${buffer}s)` };
  }
  const queued = input.policy.preferQueueOverValue ? pickFromQueue(input.policy, input.available) : null;
  if (queued) {
    return { ...base, shouldAct: true, player: queued, reason: `Queue target ${queued.name} available with ${remaining.toFixed(1)}s left` };
  }
  const top = input.recommendations.find((recommendation) => !input.policy.avoidPlayerIds.includes(recommendation.player.id));
  if (top) {
    return { ...base, shouldAct: true, player: top.player, reason: `Top recommendation ${top.player.name}: ${top.reasons.join("; ")}` };
  }
  const fallback = input.available.find((player) => !input.policy.avoidPlayerIds.includes(player.id)) ?? null;
  if (fallback) {
    return { ...base, shouldAct: true, player: fallback, reason: `Fallback to best available ${fallback.name}` };
  }
  return { ...base, shouldAct: false, player: null, reason: "No available players to select" };
}
