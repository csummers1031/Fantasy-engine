import { buildPlayerPool } from "@/lib/data/player-pool";
import type { DraftState } from "@/lib/types";
import { getDraft, getDraftPicks, getLeague, getLeagueRosters, getLeagueUsers } from "./client";
import { buildDraftState, mapLeagueSettings } from "./mapper";

export * from "./client";
export * from "./mapper";
export * from "./types";

export async function fetchSleeperDraftState(leagueId: string, userId: string, draftIdOverride: string = ""): Promise<DraftState> {
  const league = await getLeague(leagueId);
  const draftId = draftIdOverride || league.draft_id;
  const [draft, picks, users, rosters] = await Promise.all([getDraft(draftId), getDraftPicks(draftId), getLeagueUsers(leagueId), getLeagueRosters(leagueId)]);
  const settings = mapLeagueSettings(league, draft);
  const pool = buildPlayerPool(settings.scoring);
  return buildDraftState({ league, draft, picks, users, rosters, userId, pool, now: Date.now() });
}
