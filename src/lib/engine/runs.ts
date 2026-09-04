import { POSITIONS } from "@/lib/types";
import type { DraftState, OpponentNeed, Position, RunAlert, ValuedPlayer } from "@/lib/types";
import { positionDeficits, rosterByPosition } from "./roster";
import { slotForOverall, nextUserPick } from "./snake";
import { premiumRemaining } from "./tiers";

const LATE_ROUND_POSITIONS: readonly Position[] = ["K", "DEF"];

export function opponentsBeforeUser(state: DraftState): OpponentNeed[] {
  const { settings, teams, picks, clock, userTeamId } = state;
  const userTeam = teams.find((team) => team.id === userTeamId);
  if (!userTeam) {
    return [];
  }
  const next = nextUserPick(clock.currentPickOverall, userTeam.slot, settings.teams, settings.rounds, settings.draftType);
  if (next < 0) {
    return [];
  }
  const needs: OpponentNeed[] = [];
  const seen = new Map<string, OpponentNeed>();
  for (let overall = clock.currentPickOverall; overall < next; overall += 1) {
    const slot = slotForOverall(overall, settings.teams, settings.draftType);
    const team = teams.find((candidate) => candidate.slot === slot);
    if (!team || team.id === userTeamId) {
      continue;
    }
    const existing = seen.get(team.id);
    if (existing) {
      existing.picksBeforeUser += 1;
      continue;
    }
    const deficits = positionDeficits(picks, team.id, settings);
    const counts = rosterByPosition(picks, team.id);
    const round = Math.ceil(overall / settings.teams);
    const likelyTargets = deficits.filter((position) => !LATE_ROUND_POSITIONS.includes(position) || round >= settings.rounds - 2);
    if (likelyTargets.length === 0) {
      const thinnest = POSITIONS.filter((position) => !LATE_ROUND_POSITIONS.includes(position)).sort((a, b) => counts[a] - counts[b])[0];
      if (thinnest) {
        likelyTargets.push(thinnest);
      }
    }
    const need: OpponentNeed = { teamId: team.id, teamName: team.name, slot: team.slot, picksBeforeUser: 1, deficits, likelyTargets };
    seen.set(team.id, need);
    needs.push(need);
  }
  return needs;
}

export function predictRuns(state: DraftState, available: ValuedPlayer[], now: number): RunAlert[] {
  const opponents = opponentsBeforeUser(state);
  const alerts: RunAlert[] = [];
  for (const position of POSITIONS) {
    const hungry = opponents.filter((opponent) => opponent.likelyTargets.includes(position));
    const hungryPicks = hungry.reduce((sum, opponent) => sum + opponent.picksBeforeUser, 0);
    const premium = premiumRemaining(available, position);
    if (premium.count === 0 || hungryPicks === 0) {
      continue;
    }
    const deficitCount = hungry.filter((opponent) => opponent.deficits.includes(position)).length;
    const critical = premium.count <= 2 && hungryPicks >= premium.count;
    const warning = premium.count <= 4 && hungryPicks >= Math.ceil(premium.count / 2);
    if (!critical && !warning) {
      continue;
    }
    const severity = critical ? "critical" : "warning";
    const message = critical
      ? `${position} run imminent: ${hungryPicks} opponent pick${hungryPicks === 1 ? "" : "s"} before your turn with ${deficitCount} starting deficit${deficitCount === 1 ? "" : "s"}, only ${premium.count} tier ${premium.tier} option${premium.count === 1 ? "" : "s"} left.`
      : `${position} pressure building: ${hungryPicks} opponent pick${hungryPicks === 1 ? "" : "s"} likely targeting ${position}, ${premium.count} tier ${premium.tier} option${premium.count === 1 ? "" : "s"} remain.`;
    alerts.push({
      id: `run_${position}_${premium.tier}_${state.clock.currentPickOverall}`,
      position,
      severity,
      message,
      opponentsHungry: hungryPicks,
      premiumRemaining: premium.count,
      tier: premium.tier,
      createdAt: now,
      playersAtRisk: premium.names,
    });
  }
  return alerts.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "critical" ? -1 : 1));
}
