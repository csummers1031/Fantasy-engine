import type { DraftPick, DraftState, DraftTeam, LeagueSettings, Player, Position, RosterSlot, ScoringSettings } from "@/lib/types";
import { DEFAULT_SCORING } from "@/lib/types";
import { coordinatesForOverall } from "@/lib/engine/snake";
import { normalizeName } from "@/lib/data/player-pool";
import type { DomDraftSnapshot, YahooDraftResult, YahooLeagueSettings, YahooTeam } from "./types";

const YAHOO_SLOT_MAP: Record<string, RosterSlot> = {
  QB: "QB",
  RB: "RB",
  WR: "WR",
  TE: "TE",
  K: "K",
  DEF: "DEF",
  "W/R/T": "FLEX",
  "W/R": "FLEX",
  "Q/W/R/T": "SUPER_FLEX",
  "W/T": "REC_FLEX",
  BN: "BN",
  IR: "IR",
  DL: "DL",
  LB: "LB",
  DB: "DB",
  D: "IDP_FLEX",
};

export function mapYahooRoster(rosterPositions: Array<{ position: string; count: number }>): RosterSlot[] {
  const slots: RosterSlot[] = [];
  for (const entry of rosterPositions) {
    const slot = YAHOO_SLOT_MAP[entry.position] ?? "BN";
    for (let i = 0; i < entry.count; i += 1) {
      slots.push(slot);
    }
  }
  return slots;
}

export function mapYahooScoring(modifiers: Array<{ statId: number; value: number }>): ScoringSettings {
  const byStat = new Map(modifiers.map((modifier) => [modifier.statId, modifier.value] as const));
  const perYard = (statId: number, fallback: number): number => {
    const value = byStat.get(statId);
    if (value === undefined || value === 0) {
      return fallback;
    }
    return Number((1 / value).toFixed(2));
  };
  return {
    passingYardsPerPoint: perYard(4, DEFAULT_SCORING.passingYardsPerPoint),
    passingTd: byStat.get(5) ?? DEFAULT_SCORING.passingTd,
    interception: byStat.get(6) ?? DEFAULT_SCORING.interception,
    rushingYardsPerPoint: perYard(9, DEFAULT_SCORING.rushingYardsPerPoint),
    rushingTd: byStat.get(10) ?? DEFAULT_SCORING.rushingTd,
    receivingYardsPerPoint: perYard(12, DEFAULT_SCORING.receivingYardsPerPoint),
    receivingTd: byStat.get(13) ?? DEFAULT_SCORING.receivingTd,
    reception: byStat.get(11) ?? 0,
    tePremium: 0,
    fumbleLost: byStat.get(18) ?? DEFAULT_SCORING.fumbleLost,
  };
}

export function mapYahooSettings(settings: YahooLeagueSettings, pickTimerSeconds: number = 90): LeagueSettings {
  const rosterPositions = mapYahooRoster(settings.rosterPositions);
  const rounds = rosterPositions.filter((slot) => slot !== "IR").length;
  return {
    teams: settings.numTeams,
    rounds: rounds > 0 ? rounds : 15,
    rosterPositions,
    scoring: mapYahooScoring(settings.statModifiers),
    draftType: settings.draftType === "auction" ? "auction" : "snake",
    pickTimerSeconds,
  };
}

export function mapYahooTeams(teams: YahooTeam[]): DraftTeam[] {
  return teams.map((team, index) => ({
    id: team.teamKey,
    name: team.name,
    slot: team.draftPosition > 0 ? team.draftPosition : index + 1,
    ownerName: "",
    isUser: team.isOwnedByCurrentLogin,
  }));
}

function positionFromText(value: string): Position {
  const upper = value.toUpperCase();
  if (upper === "QB" || upper === "RB" || upper === "WR" || upper === "TE" || upper === "K") {
    return upper;
  }
  if (upper === "DEF" || upper === "DST" || upper === "D/ST") {
    return "DEF";
  }
  return "WR";
}

export function mapYahooApiPicks(results: YahooDraftResult[], settings: LeagueSettings, playerNamesByKey: Map<string, string>, pool: Player[]): DraftPick[] {
  const poolByName = new Map(pool.map((player) => [normalizeName(player.name), player] as const));
  return results.map((result) => {
    const name = playerNamesByKey.get(result.playerKey) ?? result.playerKey;
    const known = poolByName.get(normalizeName(name));
    const coordinates = coordinatesForOverall(result.pick, settings.teams, settings.draftType);
    return {
      overall: result.pick,
      round: result.round || coordinates.round,
      pickInRound: coordinates.pickInRound,
      slot: coordinates.slot,
      teamId: result.teamKey,
      playerId: known ? known.id : `yahoo:${result.playerKey}`,
      playerName: name,
      position: known ? known.position : "WR",
      timestamp: 0,
    };
  });
}

export function mapDomPicks(snapshot: DomDraftSnapshot, settings: LeagueSettings, teams: DraftTeam[], pool: Player[]): DraftPick[] {
  const poolByName = new Map(pool.map((player) => [normalizeName(player.name), player] as const));
  const teamByName = new Map(teams.map((team) => [normalizeName(team.name), team] as const));
  return snapshot.picks.map((pick) => {
    const known = poolByName.get(normalizeName(pick.playerName));
    const coordinates = coordinatesForOverall(pick.overall, settings.teams, settings.draftType);
    const team = teamByName.get(normalizeName(pick.teamName)) ?? teams.find((candidate) => candidate.slot === coordinates.slot);
    return {
      overall: pick.overall,
      round: coordinates.round,
      pickInRound: coordinates.pickInRound,
      slot: coordinates.slot,
      teamId: team ? team.id : `slot:${coordinates.slot}`,
      playerId: known ? known.id : `yahoo-dom:${normalizeName(pick.playerName)}`,
      playerName: known ? known.name : pick.playerName,
      position: known ? known.position : positionFromText(pick.position),
      timestamp: 0,
    };
  });
}

export interface YahooDraftBundle {
  leagueKey: string;
  settings: LeagueSettings;
  teams: DraftTeam[];
  picks: DraftPick[];
  status: DraftState["status"];
  secondsRemaining: number;
  now: number;
}

export function buildYahooDraftState(bundle: YahooDraftBundle): DraftState {
  const total = bundle.settings.teams * bundle.settings.rounds;
  const currentPickOverall = Math.min(total, bundle.picks.length + 1);
  const coordinates = coordinatesForOverall(currentPickOverall, bundle.settings.teams, bundle.settings.draftType);
  const onClock = bundle.teams.find((team) => team.slot === coordinates.slot);
  const userTeam = bundle.teams.find((team) => team.isUser);
  const remainingMs = bundle.secondsRemaining >= 0 ? bundle.secondsRemaining * 1000 : bundle.settings.pickTimerSeconds * 1000;
  return {
    provider: "yahoo",
    leagueId: bundle.leagueKey,
    draftId: bundle.leagueKey,
    status: bundle.status,
    settings: bundle.settings,
    teams: bundle.teams,
    picks: bundle.picks,
    clock: {
      currentPickOverall,
      onClockTeamId: onClock ? onClock.id : "",
      pickStartedAt: bundle.now - (bundle.settings.pickTimerSeconds * 1000 - remainingMs),
      pickDeadlineAt: bundle.now + remainingMs,
      secondsPerPick: bundle.settings.pickTimerSeconds,
    },
    userTeamId: userTeam ? userTeam.id : "",
    updatedAt: bundle.now,
  };
}
