import type { Position, ScoringSettings } from "@/lib/types";

export interface PositionCurve {
  top: number;
  floor: number;
  decay: number;
  receptionsShare: number;
}

export const ADP_CURVES: Record<Position, PositionCurve> = {
  QB: { top: 390, floor: 210, decay: 0.055, receptionsShare: 0 },
  RB: { top: 330, floor: 90, decay: 0.045, receptionsShare: 0.28 },
  WR: { top: 320, floor: 95, decay: 0.032, receptionsShare: 0.42 },
  TE: { top: 230, floor: 60, decay: 0.11, receptionsShare: 0.45 },
  K: { top: 150, floor: 105, decay: 0.09, receptionsShare: 0 },
  DEF: { top: 140, floor: 85, decay: 0.09, receptionsShare: 0 },
};

export function projectedPointsForRank(position: Position, positionalRank: number, scoring: ScoringSettings): number {
  const curve = ADP_CURVES[position];
  const base = curve.floor + (curve.top - curve.floor) * Math.exp(-curve.decay * (positionalRank - 1));
  const receptionAdjustment = curve.receptionsShare * (scoring.reception - 1) * 60 * Math.exp(-curve.decay * (positionalRank - 1));
  const tePremium = position === "TE" ? scoring.tePremium * 55 * Math.exp(-curve.decay * (positionalRank - 1)) : 0;
  const passingScale = position === "QB" ? scoring.passingTd / 4 : 1;
  return Number((base * passingScale + receptionAdjustment + tePremium).toFixed(1));
}

export function expectedPickProbability(adp: number, overall: number): number {
  const distance = overall - adp;
  if (distance >= 8) {
    return 0.98;
  }
  if (distance >= 0) {
    return 0.5 + distance * 0.06;
  }
  if (distance >= -10) {
    return Math.max(0.02, 0.5 + distance * 0.048);
  }
  return 0.02;
}
