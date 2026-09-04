import type { DraftPick, DraftState, DraftTeam, LeagueSettings, Player, Position, RosterSlot, ScoringSettings } from "@/lib/types";
import { DEFAULT_SCORING, POSITIONS } from "@/lib/types";
import { AppError } from "@/lib/errors";
import { coordinatesForOverall } from "@/lib/engine/snake";
import { normalizeName } from "@/lib/data/player-pool";
import type { SleeperDraft, SleeperLeague, SleeperPick, SleeperRoster, SleeperUser } from "./types";

const SLEEPER_SLOT_MAP: Record<string, RosterSlot> = {
  QB: "QB",
  RB: "RB",
  WR: "WR",
  TE: "TE",
  K: "K",
  DEF: "DEF",
  FLEX: "FLEX",
  SUPER_FLEX: "SUPER_FLEX",
  REC_FLEX: "REC_FLEX",
  BN: "BN",
  IR: "IR",
  IDP_FLEX: "IDP_FLEX",
  DL: "DL",
  LB: "LB",
  DB: "DB",
};

export function mapRosterPositions(rosterPositions: string[]): RosterSlot[] {
  return rosterPositions.map((slot) => SLEEPER_SLOT_MAP[slot] ?? "BN");
}

export function mapScoring(scoring: Record<string, number>): ScoringSettings {
  const perYard = (value: number | undefined, fallbackPerPoint: number): number => {
    if (value === undefined || value === 0) {
      return fallbackPerPoint;
    }
    return Number((1 / value).toFixed(2));
  };
  return {
    passingYardsPerPoint: perYard(scoring.pass_yd, DEFAULT_SCORING.passingYardsPerPoint),
    passingTd: scoring.pass_td ?? DEFAULT_SCORING.passingTd,
    interception: scoring.pass_int ?? DEFAULT_SCORING.interception,
    rushingYardsPerPoint: perYard(scoring.rush_yd, DEFAULT_SCORING.rushingYardsPerPoint),
    rushingTd: scoring.rush_td ?? DEFAULT_SCORING.rushingTd,
    receivingYardsPerPoint: perYard(scoring.rec_yd, DEFAULT_SCORING.receivingYardsPerPoint),
    receivingTd: scoring.rec_td ?? DEFAULT_SCORING.receivingTd,
    reception: scoring.rec ?? 0,
    tePremium: scoring.bonus_rec_te ?? 0,
    fumbleLost: scoring.fum_lost ?? DEFAULT_SCORING.fumbleLost,
  };
}

export function mapLeagueSettings(league: SleeperLeague, draft: SleeperDraft): LeagueSettings {
  return {
    teams: draft.settings.teams || league.total_rosters,
    rounds: draft.settings.rounds || league.roster_positions.filter((slot) => slot !== "IR").length,
    rosterPositions: mapRosterPositions(league.roster_positions),
    scoring: mapScoring(league.scoring_settings),
    draftType: draft.type,
    pickTimerSeconds: draft.settings.pick_timer || 90,
  };
}

export function mapTeams(draft: SleeperDraft, users: SleeperUser[], rosters: SleeperRoster[], userId: string): DraftTeam[] {
  const teams: DraftTeam[] = [];
  const usersById = new Map(users.map((user) => [user.user_id, user] as const));
  const rosterByOwner = new Map<string, number>();
  for (const roster of rosters) {
    if (roster.owner_id) {
      rosterByOwner.set(roster.owner_id, roster.roster_id);
    }
  }
  const slotToRoster = draft.slot_to_roster_id ?? {};
  if (draft.draft_order) {
    for (const [ownerId, slot] of Object.entries(draft.draft_order)) {
      const user = usersById.get(ownerId);
      const rosterId = rosterByOwner.get(ownerId) ?? slotToRoster[String(slot)] ?? slot;
      teams.push({
        id: String(rosterId),
        name: user?.metadata?.team_name || user?.display_name || `Slot ${slot}`,
        slot,
        ownerName: user?.display_name ?? ownerId,
        isUser: ownerId === userId,
      });
    }
  }
  for (let slot = 1; slot <= draft.settings.teams; slot += 1) {
    if (!teams.some((team) => team.slot === slot)) {
      const rosterId = slotToRoster[String(slot)] ?? slot;
      teams.push({ id: String(rosterId), name: `Slot ${slot}`, slot, ownerName: "", isUser: false });
    }
  }
  return teams.sort((a, b) => a.slot - b.slot);
}

export function resolvePosition(value: string): Position {
  const upper = value.toUpperCase();
  if ((POSITIONS as readonly string[]).includes(upper)) {
    return upper as Position;
  }
  if (upper === "DST" || upper === "D/ST") {
    return "DEF";
  }
  throw new AppError("PROVIDER_PARSE", `Unknown position ${value}`);
}

export function mapPicks(picks: SleeperPick[], settings: LeagueSettings, pool: Player[]): DraftPick[] {
  const poolByName = new Map(pool.map((player) => [normalizeName(player.name), player] as const));
  const poolBySleeperId = new Map<string, Player>();
  for (const player of pool) {
    const sleeperId = player.providerIds.sleeper;
    if (sleeperId) {
      poolBySleeperId.set(sleeperId, player);
    }
  }
  return picks
    .filter((pick) => pick.player_id !== "")
    .map((pick) => {
      const fullName = `${pick.metadata.first_name ?? ""} ${pick.metadata.last_name ?? ""}`.trim();
      const known = poolBySleeperId.get(pick.player_id) ?? poolByName.get(normalizeName(fullName));
      const coordinates = coordinatesForOverall(pick.pick_no, settings.teams, settings.draftType);
      let position: Position = "WR";
      try {
        position = known ? known.position : resolvePosition(pick.metadata.position ?? "WR");
      } catch {
        position = "WR";
      }
      return {
        overall: pick.pick_no,
        round: pick.round || coordinates.round,
        pickInRound: coordinates.pickInRound,
        slot: pick.draft_slot || coordinates.slot,
        teamId: String(pick.roster_id),
        playerId: known ? known.id : `sleeper:${pick.player_id}`,
        playerName: fullName || pick.player_id,
        position,
        timestamp: 0,
      };
    })
    .sort((a, b) => a.overall - b.overall);
}

export interface SleeperDraftBundle {
  league: SleeperLeague;
  draft: SleeperDraft;
  picks: SleeperPick[];
  users: SleeperUser[];
  rosters: SleeperRoster[];
  userId: string;
  pool: Player[];
  now: number;
}

export function buildDraftState(bundle: SleeperDraftBundle): DraftState {
  const settings = mapLeagueSettings(bundle.league, bundle.draft);
  const teams = mapTeams(bundle.draft, bundle.users, bundle.rosters, bundle.userId);
  const picks = mapPicks(bundle.picks, settings, bundle.pool);
  const currentPickOverall = Math.min(settings.teams * settings.rounds, picks.length + 1);
  const coordinates = coordinatesForOverall(currentPickOverall, settings.teams, settings.draftType);
  const onClock = teams.find((team) => team.slot === coordinates.slot);
  const userTeam = teams.find((team) => team.isUser);
  const lastPicked = bundle.draft.last_picked ?? bundle.draft.start_time ?? bundle.now;
  const pickStartedAt = picks.length === 0 ? (bundle.draft.start_time ?? bundle.now) : lastPicked;
  return {
    provider: "sleeper",
    leagueId: bundle.league.league_id,
    draftId: bundle.draft.draft_id,
    status: bundle.draft.status,
    settings,
    teams,
    picks,
    clock: {
      currentPickOverall,
      onClockTeamId: onClock ? onClock.id : "",
      pickStartedAt,
      pickDeadlineAt: pickStartedAt + settings.pickTimerSeconds * 1000,
      secondsPerPick: settings.pickTimerSeconds,
    },
    userTeamId: userTeam ? userTeam.id : "",
    updatedAt: bundle.now,
  };
}
