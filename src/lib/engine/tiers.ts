import { POSITIONS } from "@/lib/types";
import type { Position, TierSummary, ValuedPlayer } from "@/lib/types";

export interface TierPoint {
  id: string;
  points: number;
}

export const TIER_GAP_RATIO = 0.06;
export const TIER_MIN_GAP = 6;
export const TIER_MAX_SIZE = 6;

export function assignTiers(points: TierPoint[]): Map<string, number> {
  const sorted = [...points].sort((a, b) => b.points - a.points);
  const result = new Map<string, number>();
  let tier = 1;
  let sizeInTier = 0;
  for (let index = 0; index < sorted.length; index += 1) {
    const current = sorted[index];
    if (!current) {
      continue;
    }
    if (index > 0) {
      const previous = sorted[index - 1];
      const previousPoints = previous ? previous.points : current.points;
      const gap = previousPoints - current.points;
      const threshold = Math.max(TIER_MIN_GAP, previousPoints * TIER_GAP_RATIO);
      if (gap >= threshold || sizeInTier >= TIER_MAX_SIZE) {
        tier += 1;
        sizeInTier = 0;
      }
    }
    result.set(current.id, tier);
    sizeInTier += 1;
  }
  return result;
}

export function survivalProbability(picksUntilUserTurn: number, remainingInTier: number, adpValues: number[], currentOverall: number): number {
  if (picksUntilUserTurn <= 0 || remainingInTier === 0) {
    return 1;
  }
  const horizon = currentOverall + picksUntilUserTurn;
  let expectedTaken = 0;
  for (const adp of adpValues) {
    const distance = horizon - adp;
    if (distance >= 6) {
      expectedTaken += 0.97;
    } else if (distance >= 0) {
      expectedTaken += 0.55 + distance * 0.07;
    } else if (distance >= -6) {
      expectedTaken += Math.max(0, 0.45 + distance * 0.07);
    }
  }
  const survivors = Math.max(0, remainingInTier - expectedTaken);
  return Number(Math.min(1, survivors / remainingInTier).toFixed(3));
}

export function summarizeTiers(available: ValuedPlayer[], currentOverall: number, picksUntilUserTurn: number): TierSummary[] {
  const summaries: TierSummary[] = [];
  for (const position of POSITIONS) {
    const group = available.filter((player) => player.position === position);
    const tierNumbers = [...new Set(group.map((player) => player.tier))].sort((a, b) => a - b).slice(0, 4);
    for (const tier of tierNumbers) {
      const remaining = group.filter((player) => player.tier === tier);
      const nextTier = group.filter((player) => player.tier === tier + 1);
      const tierFloor = remaining[remaining.length - 1]?.projectedPoints ?? 0;
      const nextCeiling = nextTier[0]?.projectedPoints ?? tierFloor;
      const probability = survivalProbability(
        picksUntilUserTurn,
        remaining.length,
        remaining.map((player) => player.adp),
        currentOverall,
      );
      summaries.push({
        position,
        tier,
        remaining,
        projectedSurvivors: Number((remaining.length * probability).toFixed(1)),
        falloffToNextTier: Number((tierFloor - nextCeiling).toFixed(1)),
        survivalProbability: probability,
      });
    }
  }
  return summaries;
}

export function premiumRemaining(available: ValuedPlayer[], position: Position): { count: number; tier: number; names: string[] } {
  const group = available.filter((player) => player.position === position);
  const first = group[0];
  if (!first) {
    return { count: 0, tier: 0, names: [] };
  }
  const tierMembers = group.filter((player) => player.tier === first.tier);
  return { count: tierMembers.length, tier: first.tier, names: tierMembers.map((player) => player.name) };
}
