import { FLEX_ELIGIBILITY, POSITIONS } from "@/lib/types";
import type { DraftPick, LeagueSettings, Position, RosterNeed, RosterSlot } from "@/lib/types";

export function rosterByPosition(picks: DraftPick[], teamId: string): Record<Position, number> {
  const counts: Record<Position, number> = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0 };
  for (const pick of picks) {
    if (pick.teamId === teamId) {
      counts[pick.position] += 1;
    }
  }
  return counts;
}

export function startersRequired(rosterPositions: RosterSlot[]): Record<Position, number> {
  const required: Record<Position, number> = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0 };
  for (const slot of rosterPositions) {
    if ((POSITIONS as readonly string[]).includes(slot)) {
      required[slot as Position] += 1;
    }
  }
  return required;
}

export function flexCapacity(rosterPositions: RosterSlot[], position: Position): number {
  let capacity = 0;
  for (const slot of rosterPositions) {
    const eligible = FLEX_ELIGIBILITY[slot];
    if (eligible && eligible.includes(position)) {
      capacity += 1;
    }
  }
  return capacity;
}

export function computeRosterNeeds(picks: DraftPick[], teamId: string, settings: LeagueSettings): RosterNeed[] {
  const counts = rosterByPosition(picks, teamId);
  const required = startersRequired(settings.rosterPositions);
  const roundsRemaining = Math.max(0, settings.rounds - picks.filter((pick) => pick.teamId === teamId).length);
  return POSITIONS.map((position) => {
    const filled = Math.min(counts[position], required[position]);
    const bench = Math.max(0, counts[position] - required[position]);
    const flex = flexCapacity(settings.rosterPositions, position);
    const missingStarters = Math.max(0, required[position] - counts[position]);
    const desiredDepth = required[position] + (position === "RB" || position === "WR" ? 2 + Math.min(1, flex) : position === "QB" || position === "TE" ? 1 : 0);
    const depthGap = Math.max(0, desiredDepth - counts[position]);
    const urgency = roundsRemaining > 0 ? Math.min(1, (missingStarters * 2 + depthGap) / Math.max(1, roundsRemaining)) : 0;
    const need = Number(Math.min(1, missingStarters * 0.6 + depthGap * 0.15 + urgency * 0.25).toFixed(3));
    return { position, startersRequired: required[position], startersFilled: filled, benchDepth: bench, need };
  });
}

export function positionDeficits(picks: DraftPick[], teamId: string, settings: LeagueSettings): Position[] {
  const counts = rosterByPosition(picks, teamId);
  const required = startersRequired(settings.rosterPositions);
  return POSITIONS.filter((position) => counts[position] < required[position]);
}
