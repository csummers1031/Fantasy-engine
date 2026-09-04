import { buildPlayerPool } from "@/lib/data/player-pool";
import type { DraftState, DraftTeam, LeagueSettings } from "@/lib/types";
import type { YahooPlayer } from "./types";
import { DEFAULT_SCORING } from "@/lib/types";
import { getDraftResults, getLeagueSettings, getPlayersByKeys, getTeams, normalizeYahooLeagueKey } from "./client";
import { parseDraftHtml } from "./dom-parser";
import { buildYahooDraftState, mapDomPicks, mapYahooApiPicks, mapYahooSettings, mapYahooTeams } from "./mapper";

export * from "./client";
export * from "./dom-parser";
export * from "./mapper";
export * from "./oauth";
export * from "./types";

export async function fetchYahooDraftState(rawLeagueKey: string, accessToken: string, pickTimerSeconds: number = 90): Promise<DraftState> {
  const leagueKey = normalizeYahooLeagueKey(rawLeagueKey);
  const [settingsRaw, teamsRaw, results] = await Promise.all([getLeagueSettings(leagueKey, accessToken), getTeams(leagueKey, accessToken), getDraftResults(leagueKey, accessToken)]);
  const settings = mapYahooSettings(settingsRaw, pickTimerSeconds);
  const pool = buildPlayerPool(settings.scoring);
  const teams = mapYahooTeams(teamsRaw);
  let players = new Map<string, YahooPlayer>();
  try {
    const looked = await getPlayersByKeys(leagueKey, results.map((result) => result.playerKey), accessToken);
    players = new Map(looked.map((player) => [player.playerKey, player] as const));
  } catch {
    players = new Map();
  }
  const picks = mapYahooApiPicks(results, settings, players, pool);
  const total = settings.teams * settings.rounds;
  const status: DraftState["status"] = picks.length >= total ? "complete" : picks.length > 0 ? "drafting" : "pre_draft";
  return buildYahooDraftState({ leagueKey, settings, teams, picks, status, secondsRemaining: -1, now: Date.now() });
}

export function defaultYahooSettings(teams: number): LeagueSettings {
  return {
    teams,
    rounds: 15,
    rosterPositions: ["QB", "WR", "WR", "WR", "RB", "RB", "TE", "FLEX", "K", "DEF", "BN", "BN", "BN", "BN", "BN"],
    scoring: { ...DEFAULT_SCORING, reception: 0.5 },
    draftType: "snake",
    pickTimerSeconds: 90,
  };
}

export function draftStateFromDomHtml(leagueKey: string, html: string, settings: LeagueSettings, knownTeams: DraftTeam[], now: number = Date.now()): DraftState {
  const snapshot = parseDraftHtml(html);
  const pool = buildPlayerPool(settings.scoring);
  const teamNames = new Set(snapshot.picks.map((pick) => pick.teamName).filter((name) => name !== ""));
  const teams: DraftTeam[] = knownTeams.length > 0 ? knownTeams : [...teamNames].map((name, index) => ({ id: `yahoo-team-${index + 1}`, name, slot: index + 1, ownerName: "", isUser: name === snapshot.userTeamName }));
  if (snapshot.userTeamName !== "" && !teams.some((team) => team.isUser)) {
    const userTeam = teams.find((team) => team.name === snapshot.userTeamName);
    if (userTeam) {
      userTeam.isUser = true;
    }
  }
  const picks = mapDomPicks(snapshot, settings, teams, pool);
  const total = settings.teams * settings.rounds;
  const status: DraftState["status"] = picks.length >= total ? "complete" : "drafting";
  return buildYahooDraftState({ leagueKey, settings, teams, picks, status, secondsRemaining: snapshot.secondsRemaining, now });
}
