import type { Position, Recommendation, RosterNeed, RunAlert, RunnerPolicy, TierSummary, ValuedPlayer } from "@/lib/types";

export interface RecommendationContext {
  available: ValuedPlayer[];
  rosterNeeds: RosterNeed[];
  tiers: TierSummary[];
  runAlerts: RunAlert[];
  policy: RunnerPolicy;
  userCounts: Record<Position, number>;
  round: number;
  totalRounds: number;
  picksUntilUserTurn: number;
}

function capReached(position: Position, context: RecommendationContext): boolean {
  const cap = context.policy.positionCaps[position];
  if (cap === undefined) {
    return false;
  }
  return context.userCounts[position] >= cap;
}

function lateRoundPenalty(position: Position, context: RecommendationContext): number {
  if (position !== "K" && position !== "DEF") {
    return 0;
  }
  const roundsLeft = context.totalRounds - context.round;
  if (roundsLeft <= 1) {
    return 0;
  }
  return Math.min(60, roundsLeft * 8);
}

export function buildRecommendations(context: RecommendationContext, limit: number = 12): Recommendation[] {
  const needByPosition = new Map<Position, number>();
  for (const need of context.rosterNeeds) {
    needByPosition.set(need.position, need.need);
  }
  const alertByPosition = new Map<Position, RunAlert>();
  for (const alert of context.runAlerts) {
    alertByPosition.set(alert.position, alert);
  }
  const tierByKey = new Map<string, TierSummary>();
  for (const tier of context.tiers) {
    tierByKey.set(`${tier.position}:${tier.tier}`, tier);
  }
  const queueIndex = new Map<string, number>();
  context.policy.queue.forEach((id, index) => queueIndex.set(id, index));
  const avoid = new Set(context.policy.avoidPlayerIds);
  const candidates = context.available.filter((player) => !avoid.has(player.id)).slice(0, 60);
  const recommendations: Recommendation[] = candidates.map((player) => {
    const reasons: string[] = [];
    const needWeight = needByPosition.get(player.position) ?? 0;
    const tier = tierByKey.get(`${player.position}:${player.tier}`);
    const scarcityWeight = tier ? 1 - tier.survivalProbability : 0;
    let score = player.vbd;
    score += needWeight * 25;
    if (needWeight >= 0.6) {
      reasons.push(`Fills a starting ${player.position} hole`);
    }
    if (tier && tier.survivalProbability < 0.5) {
      score += scarcityWeight * 18;
      reasons.push(`Tier ${player.tier} ${player.position} unlikely to survive ${context.picksUntilUserTurn} picks`);
    }
    if (tier && tier.falloffToNextTier >= 12) {
      score += Math.min(15, tier.falloffToNextTier * 0.5);
      reasons.push(`${tier.falloffToNextTier.toFixed(0)} pt cliff to next ${player.position} tier`);
    }
    const alert = alertByPosition.get(player.position);
    if (alert) {
      score += alert.severity === "critical" ? 20 : 10;
      reasons.push(alert.severity === "critical" ? `${player.position} run imminent` : `${player.position} run pressure`);
    }
    if (player.adpDelta > 8) {
      score += Math.min(12, player.adpDelta * 0.4);
      reasons.push(`Falling ${player.adpDelta.toFixed(0)} spots past ADP`);
    }
    if (capReached(player.position, context)) {
      score -= 80;
      reasons.push(`${player.position} cap reached`);
    }
    if (player.injuryStatus !== "healthy") {
      score -= player.injuryStatus === "questionable" ? 4 : 30;
      reasons.push(`Injury status ${player.injuryStatus}`);
    }
    score -= lateRoundPenalty(player.position, context);
    const queuePosition = queueIndex.get(player.id);
    if (queuePosition !== undefined) {
      score += context.policy.preferQueueOverValue ? 40 - queuePosition * 2 : 6;
      reasons.push(`Queued #${queuePosition + 1}`);
    }
    if (reasons.length === 0) {
      reasons.push(`Best available by value over replacement (+${player.vbd.toFixed(1)})`);
    }
    return { player, score: Number(score.toFixed(2)), reasons, needWeight, scarcityWeight };
  });
  return recommendations.sort((a, b) => b.score - a.score).slice(0, limit);
}
