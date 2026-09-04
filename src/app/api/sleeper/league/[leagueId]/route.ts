import { handle, jsonOk, type RouteContext } from "@/lib/api/respond";
import { getDraft, getLeague, mapLeagueSettings } from "@/lib/integrations/sleeper";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: RouteContext<{ leagueId: string }>): Promise<Response> {
  return handle(async () => {
    const { leagueId } = await context.params;
    const league = await getLeague(leagueId);
    const draft = league.draft_id !== "" ? await getDraft(league.draft_id) : null;
    return jsonOk({
      league,
      draft,
      mapped: draft ? mapLeagueSettings(league, draft) : null,
    });
  });
}
