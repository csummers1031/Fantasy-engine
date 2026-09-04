import { FLEX_ELIGIBILITY, POSITIONS } from "@/lib/types";
import type { LeagueSettings, Player, Position, RosterSlot } from "@/lib/types";
import type { ReplacementLevels } from "@/lib/types";

export function countStarters(rosterPositions: RosterSlot[]): Record<Position, number> {
  const starters: Record<Position, number> = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0 };
  for (const slot of rosterPositions) {
    if ((POSITIONS as readonly string[]).includes(slot)) {
      starters[slot as Position] += 1;
    }
  }
  return starters;
}

export function countFlexSlots(rosterPositions: RosterSlot[]): Record<string, number> {
  const flex: Record<string, number> = {};
  for (const slot of rosterPositions) {
    if (FLEX_ELIGIBILITY[slot]) {
      flex[slot] = (flex[slot] ?? 0) + 1;
    }
  }
  return flex;
}

export function countBench(rosterPositions: RosterSlot[]): number {
  return rosterPositions.filter((slot) => slot === "BN").length;
}

function distributeFlex(rosterPositions: RosterSlot[], teams: number, players: Player[]): Record<Position, number> {
  const starters = countStarters(rosterPositions);
  const flexSlots = countFlexSlots(rosterPositions);
  const leagueStarters: Record<Position, number> = { ...starters };
  for (const position of POSITIONS) {
    leagueStarters[position] = starters[position] * teams;
  }
  const sortedByPosition: Record<Position, Player[]> = { QB: [], RB: [], WR: [], TE: [], K: [], DEF: [] };
  for (const player of players) {
    sortedByPosition[player.position].push(player);
  }
  for (const position of POSITIONS) {
    sortedByPosition[position].sort((a, b) => b.projectedPoints - a.projectedPoints);
  }
  for (const [slot, count] of Object.entries(flexSlots)) {
    const eligible = FLEX_ELIGIBILITY[slot] ?? [];
    const totalSlots = count * teams;
    for (let i = 0; i < totalSlots; i += 1) {
      let bestPosition: Position | null = null;
      let bestPoints = -Infinity;
      for (const position of eligible) {
        const candidate = sortedByPosition[position][leagueStarters[position]];
        if (candidate && candidate.projectedPoints > bestPoints) {
          bestPoints = candidate.projectedPoints;
          bestPosition = position;
        }
      }
      if (bestPosition) {
        leagueStarters[bestPosition] += 1;
      }
    }
  }
  return leagueStarters;
}

export function computeReplacementLevels(players: Player[], settings: LeagueSettings): ReplacementLevels {
  const leagueStarters = distributeFlex(settings.rosterPositions, settings.teams, players);
  const byPosition: Record<Position, number> = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0 };
  const startersByPosition: Record<Position, number> = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0 };
  const benchShare = Math.max(0, Math.floor(countBench(settings.rosterPositions) * 0.5));
  for (const position of POSITIONS) {
    const pool = players.filter((player) => player.position === position).sort((a, b) => b.projectedPoints - a.projectedPoints);
    const starterCount = leagueStarters[position];
    startersByPosition[position] = starterCount;
    const benchAdjustment = position === "RB" || position === "WR" ? benchShare * Math.ceil(settings.teams / 2) : 0;
    const replacementIndex = Math.min(pool.length - 1, Math.max(0, starterCount + benchAdjustment));
    const replacement = pool[replacementIndex];
    byPosition[position] = replacement ? replacement.projectedPoints : 0;
  }
  return { byPosition, startersByPosition };
}
