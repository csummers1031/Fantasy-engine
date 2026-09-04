import { fetchJson, asArray, asNumber, asRecord, asString } from "../http";
import { AppError } from "@/lib/errors";
import type { SleeperDraft, SleeperLeague, SleeperPick, SleeperRoster, SleeperUser } from "./types";

export function sleeperBase(): string {
  return (process.env.SLEEPER_API_BASE ?? "https://api.sleeper.app/v1").replace(/\/$/, "");
}

export async function getLeague(leagueId: string): Promise<SleeperLeague> {
  const raw = asRecord(await fetchJson<unknown>(`${sleeperBase()}/league/${encodeURIComponent(leagueId)}`));
  return parseLeague(raw);
}

export function parseLeague(raw: Record<string, unknown>): SleeperLeague {
  const leagueId = asString(raw.league_id);
  if (!leagueId) {
    throw new AppError("PROVIDER_PARSE", "Sleeper league payload missing league_id");
  }
  const scoring: Record<string, number> = {};
  for (const [key, value] of Object.entries(asRecord(raw.scoring_settings))) {
    scoring[key] = asNumber(value);
  }
  const settings: Record<string, number> = {};
  for (const [key, value] of Object.entries(asRecord(raw.settings))) {
    settings[key] = asNumber(value);
  }
  return {
    league_id: leagueId,
    name: asString(raw.name, "Sleeper League"),
    season: asString(raw.season, String(new Date().getFullYear())),
    status: asString(raw.status),
    total_rosters: asNumber(raw.total_rosters, 12),
    roster_positions: asArray(raw.roster_positions).map((slot) => asString(slot)).filter((slot) => slot !== ""),
    scoring_settings: scoring,
    draft_id: asString(raw.draft_id),
    settings,
  };
}

export async function getLeagueUsers(leagueId: string): Promise<SleeperUser[]> {
  const raw = asArray(await fetchJson<unknown>(`${sleeperBase()}/league/${encodeURIComponent(leagueId)}/users`));
  return raw.map((entry) => {
    const record = asRecord(entry);
    const metadata = asRecord(record.metadata);
    return {
      user_id: asString(record.user_id),
      username: asString(record.username),
      display_name: asString(record.display_name),
      metadata: { team_name: asString(metadata.team_name) || undefined },
    };
  });
}

export async function getLeagueRosters(leagueId: string): Promise<SleeperRoster[]> {
  const raw = asArray(await fetchJson<unknown>(`${sleeperBase()}/league/${encodeURIComponent(leagueId)}/rosters`));
  return raw.map((entry) => {
    const record = asRecord(entry);
    return {
      roster_id: asNumber(record.roster_id),
      owner_id: record.owner_id === null ? null : asString(record.owner_id),
      players: Array.isArray(record.players) ? record.players.map((id) => asString(id)) : null,
    };
  });
}

export async function getDraft(draftId: string): Promise<SleeperDraft> {
  const raw = asRecord(await fetchJson<unknown>(`${sleeperBase()}/draft/${encodeURIComponent(draftId)}`));
  return parseDraft(raw);
}

export function parseDraft(raw: Record<string, unknown>): SleeperDraft {
  const settings = asRecord(raw.settings);
  const status = asString(raw.status, "pre_draft");
  const type = asString(raw.type, "snake");
  const draftOrder: Record<string, number> = {};
  for (const [key, value] of Object.entries(asRecord(raw.draft_order))) {
    draftOrder[key] = asNumber(value);
  }
  const slotToRoster: Record<string, number> = {};
  for (const [key, value] of Object.entries(asRecord(raw.slot_to_roster_id))) {
    slotToRoster[key] = asNumber(value);
  }
  return {
    draft_id: asString(raw.draft_id),
    league_id: asString(raw.league_id),
    status: status === "drafting" || status === "paused" || status === "complete" ? status : "pre_draft",
    type: type === "linear" || type === "auction" ? type : "snake",
    start_time: raw.start_time === null || raw.start_time === undefined ? null : asNumber(raw.start_time),
    last_picked: raw.last_picked === null || raw.last_picked === undefined ? null : asNumber(raw.last_picked),
    settings: {
      teams: asNumber(settings.teams, 12),
      rounds: asNumber(settings.rounds, 15),
      pick_timer: asNumber(settings.pick_timer, 90),
      slots_qb: asNumber(settings.slots_qb, 0),
      slots_rb: asNumber(settings.slots_rb, 0),
      slots_wr: asNumber(settings.slots_wr, 0),
      slots_te: asNumber(settings.slots_te, 0),
      slots_flex: asNumber(settings.slots_flex, 0),
      slots_k: asNumber(settings.slots_k, 0),
      slots_def: asNumber(settings.slots_def, 0),
      slots_bn: asNumber(settings.slots_bn, 0),
      slots_super_flex: asNumber(settings.slots_super_flex, 0),
    },
    draft_order: Object.keys(draftOrder).length > 0 ? draftOrder : null,
    slot_to_roster_id: Object.keys(slotToRoster).length > 0 ? slotToRoster : null,
  };
}

export async function getDraftPicks(draftId: string): Promise<SleeperPick[]> {
  const raw = asArray(await fetchJson<unknown>(`${sleeperBase()}/draft/${encodeURIComponent(draftId)}/picks`));
  return raw.map(parsePick);
}

export function parsePick(entry: unknown): SleeperPick {
  const record = asRecord(entry);
  const metadata = asRecord(record.metadata);
  return {
    round: asNumber(record.round),
    roster_id: asNumber(record.roster_id),
    player_id: asString(record.player_id),
    picked_by: asString(record.picked_by),
    pick_no: asNumber(record.pick_no),
    draft_slot: asNumber(record.draft_slot),
    is_keeper: record.is_keeper === true,
    metadata: {
      first_name: asString(metadata.first_name),
      last_name: asString(metadata.last_name),
      position: asString(metadata.position),
      team: asString(metadata.team),
    },
  };
}

export async function getUserByUsername(username: string): Promise<SleeperUser> {
  const record = asRecord(await fetchJson<unknown>(`${sleeperBase()}/user/${encodeURIComponent(username)}`));
  const userId = asString(record.user_id);
  if (!userId) {
    throw new AppError("NOT_FOUND", `Sleeper user ${username} not found`);
  }
  return { user_id: userId, username: asString(record.username), display_name: asString(record.display_name), metadata: null };
}

export async function getUserLeagues(userId: string, season: number): Promise<SleeperLeague[]> {
  const raw = asArray(await fetchJson<unknown>(`${sleeperBase()}/user/${encodeURIComponent(userId)}/leagues/nfl/${season}`));
  return raw.map((entry) => parseLeague(asRecord(entry)));
}
