import type { DraftPick, DraftState, DraftTeam, LeagueSettings, Player, Position, RosterSlot, ScoringSettings } from "@/lib/types";
import { DEFAULT_SCORING } from "@/lib/types";
import { coordinatesForOverall } from "@/lib/engine/snake";
import { normalizeName } from "@/lib/data/player-pool";
import type { EspnLeagueResponse, EspnPlayerInfo } from "./types";

export const ESPN_SLOT_IDS: Record<string, RosterSlot> = {
  "0": "QB",
  "2": "RB",
  "4": "WR",
  "6": "TE",
  "7": "SUPER_FLEX",
  "16": "DEF",
  "17": "K",
  "20": "BN",
  "21": "IR",
  "23": "FLEX",
};

export const ESPN_POSITION_IDS: Record<number, Position> = {
  1: "QB",
  2: "RB",
  3: "WR",
  4: "TE",
  5: "K",
  16: "DEF",
};

export function mapLineupSlots(lineupSlotCounts: Record<string, number>): RosterSlot[] {
  const slots: RosterSlot[] = [];
  const order = ["0", "2", "4", "6", "23", "7", "16", "17", "20", "21"];
  for (const key of order) {
    const count = lineupSlotCounts[key] ?? 0;
    const slot = ESPN_SLOT_IDS[key];
    if (slot) {
      for (let i = 0; i < count; i += 1) {
        slots.push(slot);
      }
    }
  }
  return slots;
}

export function mapEspnScoring(items: Array<{ statId: number; points: number }>): ScoringSettings {
  const byStat = new Map(items.map((item) => [item.statId, item.points] as const));
  const perYard = (statId: number, fallback: number): number => {
    const points = byStat.get(statId);
    if (points === undefined || points === 0) {
      return fallback;
    }
    return Number((1 / points).toFixed(2));
  };
  return {
    passingYardsPerPoint: perYard(3, DEFAULT_SCORING.passingYardsPerPoint),
    passingTd: byStat.get(4) ?? DEFAULT_SCORING.passingTd,
    interception: byStat.get(20) ?? DEFAULT_SCORING.interception,
    rushingYardsPerPoint: perYard(24, DEFAULT_SCORING.rushingYardsPerPoint),
    rushingTd: byStat.get(25) ?? DEFAULT_SCORING.rushingTd,
    receivingYardsPerPoint: perYard(42, DEFAULT_SCORING.receivingYardsPerPoint),
    receivingTd: byStat.get(43) ?? DEFAULT_SCORING.receivingTd,
    reception: byStat.get(53) ?? 0,
    tePremium: 0,
    fumbleLost: byStat.get(72) ?? DEFAULT_SCORING.fumbleLost,
  };
}

export function mapEspnSettings(league: EspnLeagueResponse): LeagueSettings {
  const rosterPositions = mapLineupSlots(league.settings.rosterSettings.lineupSlotCounts);
  const rounds = rosterPositions.filter((slot) => slot !== "IR").length;
  const type = league.settings.draftSettings.type.toUpperCase();
  return {
    teams: league.settings.size || league.teams.length,
    rounds: rounds > 0 ? rounds : 16,
    rosterPositions,
    scoring: mapEspnScoring(league.settings.scoringSettings.scoringItems),
    draftType: type === "AUCTION" ? "auction" : type === "LINEAR" ? "linear" : "snake",
    pickTimerSeconds: league.settings.draftSettings.timePerSelection || 90,
  };
}

export function mapEspnTeams(league: EspnLeagueResponse, userSwid: string): DraftTeam[] {
  const normalizedSwid = userSwid.replace(/[{}]/g, "").toUpperCase();
  const membersById = new Map(league.members.map((member) => [member.id.replace(/[{}]/g, "").toUpperCase(), member.displayName] as const));
  const pickOrder = league.settings.draftSettings.pickOrder;
  return league.teams
    .map((team) => {
      const orderIndex = pickOrder.indexOf(team.id);
      const slot = orderIndex >= 0 ? orderIndex + 1 : team.id;
      const ownerIds = team.owners.map((owner) => owner.replace(/[{}]/g, "").toUpperCase());
      const ownerName = ownerIds.map((id) => membersById.get(id) ?? "").find((name) => name !== "") ?? "";
      return {
        id: String(team.id),
        name: team.name,
        slot,
        ownerName,
        isUser: normalizedSwid !== "" && ownerIds.includes(normalizedSwid),
      };
    })
    .sort((a, b) => a.slot - b.slot);
}

export function mapEspnPicks(league: EspnLeagueResponse, settings: LeagueSettings, pool: Player[], playerInfo: EspnPlayerInfo[]): DraftPick[] {
  const infoById = new Map(playerInfo.map((info) => [info.id, info] as const));
  const poolByName = new Map(pool.map((player) => [normalizeName(player.name), player] as const));
  return league.draftDetail.picks
    .filter((pick) => pick.playerId > 0)
    .map((pick) => {
      const info = infoById.get(pick.playerId);
      const known = info ? poolByName.get(normalizeName(info.fullName)) : undefined;
      const coordinates = coordinatesForOverall(pick.overallPickNumber, settings.teams, settings.draftType);
      const position: Position = known ? known.position : info ? (ESPN_POSITION_IDS[info.defaultPositionId] ?? "WR") : "WR";
      return {
        overall: pick.overallPickNumber,
        round: pick.roundId || coordinates.round,
        pickInRound: pick.roundPickNumber || coordinates.pickInRound,
        slot: coordinates.slot,
        teamId: String(pick.teamId),
        playerId: known ? known.id : `espn:${pick.playerId}`,
        playerName: info ? info.fullName : `ESPN player ${pick.playerId}`,
        position,
        timestamp: 0,
      };
    })
    .sort((a, b) => a.overall - b.overall);
}

export interface EspnDraftBundle {
  league: EspnLeagueResponse;
  playerInfo: EspnPlayerInfo[];
  pool: Player[];
  userSwid: string;
  now: number;
}

export function buildEspnDraftState(bundle: EspnDraftBundle): DraftState {
  const settings = mapEspnSettings(bundle.league);
  const teams = mapEspnTeams(bundle.league, bundle.userSwid);
  const picks = mapEspnPicks(bundle.league, settings, bundle.pool, bundle.playerInfo);
  const total = settings.teams * settings.rounds;
  const currentPickOverall = Math.min(total, picks.length + 1);
  const coordinates = coordinatesForOverall(currentPickOverall, settings.teams, settings.draftType);
  const onClock = teams.find((team) => team.slot === coordinates.slot);
  const userTeam = teams.find((team) => team.isUser);
  const status = bundle.league.draftDetail.drafted ? "complete" : bundle.league.draftDetail.inProgress ? "drafting" : "pre_draft";
  const pickStartedAt = bundle.now;
  return {
    provider: "espn",
    leagueId: String(bundle.league.id),
    draftId: String(bundle.league.id),
    status,
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
