import { fetchJson, asArray, asNumber, asRecord, asString } from "../http";
import type { YahooDraftResult, YahooLeagueSettings, YahooPlayer, YahooTeam } from "./types";

export function yahooBase(): string {
  return (process.env.YAHOO_API_BASE ?? "https://fantasysports.yahooapis.com/fantasy/v2").replace(/\/$/, "");
}

function authHeaders(accessToken: string): Record<string, string> {
  return { Authorization: `Bearer ${accessToken}` };
}

function collectionEntries(collection: unknown): Record<string, unknown>[] {
  const record = asRecord(collection);
  const entries: Record<string, unknown>[] = [];
  for (const [key, value] of Object.entries(record)) {
    if (key === "count") {
      continue;
    }
    entries.push(asRecord(value));
  }
  return entries;
}

function flattenFragments(fragments: unknown): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  for (const fragment of asArray(fragments)) {
    if (Array.isArray(fragment)) {
      Object.assign(merged, flattenFragments(fragment));
    } else {
      Object.assign(merged, asRecord(fragment));
    }
  }
  return merged;
}

export function parseDraftResults(raw: unknown): YahooDraftResult[] {
  const root = asRecord(asRecord(raw).fantasy_content);
  const leagueArray = asArray(root.league);
  const results: YahooDraftResult[] = [];
  for (const fragment of leagueArray) {
    const record = asRecord(fragment);
    if (!record.draft_results) {
      continue;
    }
    for (const entry of collectionEntries(record.draft_results)) {
      const draftResult = asRecord(entry.draft_result);
      const pick = asNumber(draftResult.pick);
      if (pick <= 0) {
        continue;
      }
      results.push({
        pick,
        round: asNumber(draftResult.round),
        teamKey: asString(draftResult.team_key),
        playerKey: asString(draftResult.player_key),
      });
    }
  }
  return results.sort((a, b) => a.pick - b.pick);
}

export function parseLeagueSettings(raw: unknown): YahooLeagueSettings {
  const root = asRecord(asRecord(raw).fantasy_content);
  const leagueArray = asArray(root.league);
  const meta = asRecord(leagueArray[0]);
  const settingsFragment = leagueArray.map((fragment) => asRecord(fragment)).find((fragment) => fragment.settings !== undefined);
  const settings = settingsFragment ? flattenFragments(settingsFragment.settings) : {};
  const rosterPositions = asArray(settings.roster_positions).map((entry) => {
    const rosterPosition = asRecord(asRecord(entry).roster_position);
    return { position: asString(rosterPosition.position), count: asNumber(rosterPosition.count, 1) };
  });
  const statModifiers = asArray(asRecord(asRecord(settings.stat_modifiers).stats).stat ?? asRecord(settings.stat_modifiers).stats).map((entry) => {
    const stat = asRecord(asRecord(entry).stat);
    return { statId: asNumber(stat.stat_id), value: asNumber(stat.value) };
  });
  return {
    leagueKey: asString(meta.league_key),
    name: asString(meta.name, "Yahoo League"),
    numTeams: asNumber(meta.num_teams, 10),
    draftType: asString(settings.draft_type, "live"),
    draftTime: asNumber(settings.draft_time),
    rosterPositions,
    statModifiers,
  };
}

export function parseTeams(raw: unknown): YahooTeam[] {
  const root = asRecord(asRecord(raw).fantasy_content);
  const leagueArray = asArray(root.league);
  const teams: YahooTeam[] = [];
  for (const fragment of leagueArray) {
    const record = asRecord(fragment);
    if (!record.teams) {
      continue;
    }
    for (const entry of collectionEntries(record.teams)) {
      const team = flattenFragments(asArray(entry.team)[0]);
      teams.push({
        teamKey: asString(team.team_key),
        name: asString(team.name),
        draftPosition: asNumber(team.draft_position),
        isOwnedByCurrentLogin: asNumber(team.is_owned_by_current_login) === 1,
      });
    }
  }
  return teams.sort((a, b) => a.draftPosition - b.draftPosition);
}

export async function getDraftResults(leagueKey: string, accessToken: string): Promise<YahooDraftResult[]> {
  const raw = await fetchJson<unknown>(`${yahooBase()}/league/${encodeURIComponent(leagueKey)}/draftresults?format=json`, { headers: authHeaders(accessToken) });
  return parseDraftResults(raw);
}

export async function getLeagueSettings(leagueKey: string, accessToken: string): Promise<YahooLeagueSettings> {
  const raw = await fetchJson<unknown>(`${yahooBase()}/league/${encodeURIComponent(leagueKey)}/settings?format=json`, { headers: authHeaders(accessToken) });
  return parseLeagueSettings(raw);
}

export async function getTeams(leagueKey: string, accessToken: string): Promise<YahooTeam[]> {
  const raw = await fetchJson<unknown>(`${yahooBase()}/league/${encodeURIComponent(leagueKey)}/teams?format=json`, { headers: authHeaders(accessToken) });
  return parseTeams(raw);
}

export const YAHOO_PLAYER_BATCH = 25;

export function normalizeYahooLeagueKey(value: string, gameKey: string = "nfl"): string {
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    return `${gameKey}.l.${trimmed}`;
  }
  return trimmed;
}

export function parsePlayers(raw: unknown): YahooPlayer[] {
  const root = asRecord(asRecord(raw).fantasy_content);
  const containers = [...asArray(root.league), ...asArray(root.players === undefined ? [] : [{ players: root.players }])];
  const players: YahooPlayer[] = [];
  for (const fragment of containers) {
    const record = asRecord(fragment);
    if (!record.players) {
      continue;
    }
    for (const entry of collectionEntries(record.players)) {
      const player = flattenFragments(asArray(entry.player)[0]);
      const name = asRecord(player.name);
      const key = asString(player.player_key);
      if (key === "") {
        continue;
      }
      players.push({
        playerKey: key,
        fullName: asString(name.full),
        position: asString(player.display_position).split(",")[0] ?? "",
        team: asString(player.editorial_team_abbr).toUpperCase(),
      });
    }
  }
  return players;
}

export async function getPlayersByKeys(leagueKey: string, playerKeys: string[], accessToken: string): Promise<YahooPlayer[]> {
  const unique = [...new Set(playerKeys.filter((key) => key !== ""))];
  const results: YahooPlayer[] = [];
  for (let index = 0; index < unique.length; index += YAHOO_PLAYER_BATCH) {
    const batch = unique.slice(index, index + YAHOO_PLAYER_BATCH);
    const raw = await fetchJson<unknown>(`${yahooBase()}/league/${encodeURIComponent(leagueKey)}/players;player_keys=${batch.map((key) => encodeURIComponent(key)).join(",")}?format=json`, { headers: authHeaders(accessToken) });
    results.push(...parsePlayers(raw));
  }
  return results;
}
