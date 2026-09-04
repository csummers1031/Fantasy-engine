import { buildPlayerPool } from "@/lib/data/player-pool";
import type { DraftState } from "@/lib/types";
import { getLeagueDraft, getPlayerInfo } from "./client";
import { buildEspnDraftState, mapEspnSettings } from "./mapper";
import type { EspnCookies } from "./types";

export * from "./client";
export * from "./cookies";
export * from "./mapper";
export * from "./types";

export async function fetchEspnDraftState(season: number, leagueId: string, cookies: EspnCookies | null): Promise<DraftState> {
  const league = await getLeagueDraft(season, leagueId, cookies);
  const settings = mapEspnSettings(league);
  const pool = buildPlayerPool(settings.scoring);
  const playerIds = [...new Set(league.draftDetail.picks.map((pick) => pick.playerId).filter((id) => id > 0))];
  let playerInfo: Awaited<ReturnType<typeof getPlayerInfo>> = [];
  try {
    playerInfo = await getPlayerInfo(season, leagueId, cookies, playerIds);
  } catch {
    playerInfo = [];
  }
  return buildEspnDraftState({ league, playerInfo, pool, userSwid: cookies ? cookies.swid : "", now: Date.now() });
}
