import { POSITIONS } from "@/lib/types";
import type { LeagueSettings, Player, Position, ValuedPlayer } from "@/lib/types";
import { computeReplacementLevels } from "./replacement";
import { assignTiers } from "./tiers";

export function computeVbd(players: Player[], settings: LeagueSettings): ValuedPlayer[] {
  const levels = computeReplacementLevels(players, settings);
  const valued: ValuedPlayer[] = players.map((player) => {
    const replacementPoints = levels.byPosition[player.position];
    const vbd = Number((player.projectedPoints - replacementPoints).toFixed(2));
    return {
      ...player,
      vbd,
      positionalRank: 0,
      overallRank: 0,
      tier: 0,
      replacementPoints,
      adpDelta: 0,
    };
  });
  valued.sort((a, b) => b.vbd - a.vbd || a.adp - b.adp);
  valued.forEach((player, index) => {
    player.overallRank = index + 1;
    player.adpDelta = Number((player.adp - player.overallRank).toFixed(1));
  });
  for (const position of POSITIONS) {
    const group = valued.filter((player) => player.position === position);
    group.forEach((player, index) => {
      player.positionalRank = index + 1;
    });
    const tiers = assignTiers(group.map((player) => ({ id: player.id, points: player.projectedPoints })));
    for (const player of group) {
      player.tier = tiers.get(player.id) ?? 1;
    }
  }
  return valued;
}

export function positionalScarcity(valued: ValuedPlayer[], position: Position, depth: number = 12): number {
  const group = valued.filter((player) => player.position === position).slice(0, depth);
  if (group.length < 2) {
    return 0;
  }
  const top = group[0]?.vbd ?? 0;
  const bottom = group[group.length - 1]?.vbd ?? 0;
  return Number(((top - bottom) / Math.max(1, group.length)).toFixed(3));
}
