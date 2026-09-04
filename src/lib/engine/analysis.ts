import type { AnalysisInput, AnalysisSnapshot, Position, ValuedPlayer } from "@/lib/types";
import { computeVbd } from "./vbd";
import { summarizeTiers } from "./tiers";
import { opponentsBeforeUser, predictRuns } from "./runs";
import { computeRosterNeeds, rosterByPosition } from "./roster";
import { buildRecommendations } from "./recommend";
import { nextUserPick, picksUntilUserTurn } from "./snake";
import { secondsRemaining } from "./autopilot";

export function analyzeDraft(input: AnalysisInput): AnalysisSnapshot {
  const { state, playerPool, policy, now } = input;
  const valued = computeVbd(playerPool, state.settings);
  const takenIds = new Set(state.picks.map((pick) => pick.playerId));
  const available = valued.filter((player) => !takenIds.has(player.id));
  const userTeam = state.teams.find((team) => team.id === state.userTeamId);
  const userSlot = userTeam ? userTeam.slot : 1;
  const currentOverall = state.clock.currentPickOverall;
  const untilTurn = picksUntilUserTurn(currentOverall, userSlot, state.settings.teams, state.settings.rounds, state.settings.draftType);
  const nextPick = nextUserPick(currentOverall, userSlot, state.settings.teams, state.settings.rounds, state.settings.draftType);
  const tiers = summarizeTiers(available, currentOverall, Math.max(0, untilTurn));
  const runAlerts = predictRuns(state, available, now);
  const opponentNeeds = opponentsBeforeUser(state);
  const rosterNeeds = computeRosterNeeds(state.picks, state.userTeamId, state.settings);
  const userCounts = rosterByPosition(state.picks, state.userTeamId);
  const valuedById = new Map(valued.map((player) => [player.id, player] as const));
  const userRoster: ValuedPlayer[] = state.picks
    .filter((pick) => pick.teamId === state.userTeamId)
    .map((pick) => valuedById.get(pick.playerId))
    .filter((player): player is ValuedPlayer => player !== undefined);
  const round = Math.ceil(currentOverall / state.settings.teams);
  const recommendations = buildRecommendations({
    available,
    rosterNeeds,
    tiers,
    runAlerts,
    policy,
    userCounts,
    round,
    totalRounds: state.settings.rounds,
    picksUntilUserTurn: Math.max(0, untilTurn),
  });
  const onClockTeam = state.teams.find((team) => team.id === state.clock.onClockTeamId);
  return {
    leagueId: state.leagueId,
    generatedAt: now,
    currentPickOverall: currentOverall,
    userNextPickOverall: nextPick,
    picksUntilUserTurn: untilTurn,
    onClockTeamName: onClockTeam ? onClockTeam.name : "",
    secondsRemaining: Number(secondsRemaining(now, state.clock.pickDeadlineAt).toFixed(1)),
    available: available.slice(0, 150),
    recommendations,
    tiers,
    opponentNeeds,
    runAlerts,
    userRoster,
    rosterNeeds,
  };
}

export function countByPosition(players: ValuedPlayer[]): Record<Position, number> {
  const counts: Record<Position, number> = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0 };
  for (const player of players) {
    counts[player.position] += 1;
  }
  return counts;
}
