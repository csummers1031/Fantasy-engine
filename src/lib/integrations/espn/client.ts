import { fetchJson, asArray, asNumber, asRecord, asString } from "../http";
import { buildCookieHeader } from "./cookies";
import type { EspnCookies, EspnLeagueResponse, EspnPlayerInfo } from "./types";

export const ESPN_DRAFT_VIEWS = ["mDraftDetail", "mSettings", "mRoster", "mTeam"] as const;

export function espnBase(): string {
  return (process.env.ESPN_API_BASE ?? "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons").replace(/\/$/, "");
}

export function leagueUrl(season: number, leagueId: string, views: readonly string[] = ESPN_DRAFT_VIEWS): string {
  const query = views.map((view) => `view=${encodeURIComponent(view)}`).join("&");
  return `${espnBase()}/${season}/segments/0/leagues/${encodeURIComponent(leagueId)}?${query}`;
}

function headersFor(cookies: EspnCookies | null, extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = {
    "User-Agent": "Mozilla/5.0 (fantasy-engine)",
    ...extra,
  };
  if (cookies) {
    headers.Cookie = buildCookieHeader(cookies);
  }
  return headers;
}

export async function getLeagueDraft(season: number, leagueId: string, cookies: EspnCookies | null): Promise<EspnLeagueResponse> {
  const raw = asRecord(await fetchJson<unknown>(leagueUrl(season, leagueId), { headers: headersFor(cookies) }));
  return parseLeagueResponse(raw);
}

export function parseLeagueResponse(raw: Record<string, unknown>): EspnLeagueResponse {
  const settings = asRecord(raw.settings);
  const rosterSettings = asRecord(settings.rosterSettings);
  const scoringSettings = asRecord(settings.scoringSettings);
  const draftSettings = asRecord(settings.draftSettings);
  const draftDetail = asRecord(raw.draftDetail);
  const lineupSlotCounts: Record<string, number> = {};
  for (const [key, value] of Object.entries(asRecord(rosterSettings.lineupSlotCounts))) {
    lineupSlotCounts[key] = asNumber(value);
  }
  return {
    id: asNumber(raw.id),
    seasonId: asNumber(raw.seasonId),
    settings: {
      name: asString(settings.name, "ESPN League"),
      size: asNumber(settings.size, 10),
      rosterSettings: { lineupSlotCounts },
      scoringSettings: {
        scoringItems: asArray(scoringSettings.scoringItems).map((item) => {
          const record = asRecord(item);
          return { statId: asNumber(record.statId), points: asNumber(record.points) };
        }),
      },
      draftSettings: {
        type: asString(draftSettings.type, "SNAKE"),
        pickOrder: asArray(draftSettings.pickOrder).map((id) => asNumber(id)),
        timePerSelection: asNumber(draftSettings.timePerSelection, 90),
        date: asNumber(draftSettings.date),
      },
    },
    draftDetail: {
      drafted: draftDetail.drafted === true,
      inProgress: draftDetail.inProgress === true,
      picks: asArray(draftDetail.picks).map((pick) => {
        const record = asRecord(pick);
        return {
          overallPickNumber: asNumber(record.overallPickNumber),
          roundId: asNumber(record.roundId),
          roundPickNumber: asNumber(record.roundPickNumber),
          teamId: asNumber(record.teamId),
          playerId: asNumber(record.playerId),
          autoDraftTypeId: asNumber(record.autoDraftTypeId),
        };
      }),
    },
    teams: asArray(raw.teams).map((team) => {
      const record = asRecord(team);
      const location = asString(record.location);
      const nickname = asString(record.nickname);
      const name = asString(record.name) || `${location} ${nickname}`.trim();
      return {
        id: asNumber(record.id),
        name: name || `Team ${asNumber(record.id)}`,
        abbrev: asString(record.abbrev),
        owners: asArray(record.owners).map((owner) => asString(owner)),
      };
    }),
    members: asArray(raw.members).map((member) => {
      const record = asRecord(member);
      return { id: asString(record.id), displayName: asString(record.displayName) };
    }),
  };
}

export async function getPlayerInfo(season: number, leagueId: string, cookies: EspnCookies | null, playerIds: number[]): Promise<EspnPlayerInfo[]> {
  if (playerIds.length === 0) {
    return [];
  }
  const filter = JSON.stringify({ players: { filterIds: { value: playerIds }, limit: playerIds.length } });
  const raw = asRecord(
    await fetchJson<unknown>(leagueUrl(season, leagueId, ["kona_player_info"]), {
      headers: headersFor(cookies, { "x-fantasy-filter": filter }),
    }),
  );
  return parsePlayerInfo(raw);
}

export function parsePlayerInfo(raw: Record<string, unknown>): EspnPlayerInfo[] {
  return asArray(raw.players).map((entry) => {
    const record = asRecord(entry);
    const player = asRecord(record.player);
    const ownership = asRecord(player.ownership);
    return {
      id: asNumber(record.id ?? player.id),
      fullName: asString(player.fullName),
      defaultPositionId: asNumber(player.defaultPositionId),
      proTeamId: asNumber(player.proTeamId),
      injuryStatus: asString(player.injuryStatus, "ACTIVE"),
      averageDraftPosition: asNumber(ownership.averageDraftPosition),
    };
  });
}
