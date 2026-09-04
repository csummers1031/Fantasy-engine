import { handle, jsonOk, parseQuery, type RouteContext } from "@/lib/api/respond";
import { espnQuerySchema } from "@/lib/api/schemas";
import { loadCredential } from "@/lib/db/credentials";
import { getLeagueDraft, mapEspnSettings, mapEspnTeams } from "@/lib/integrations/espn";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: RouteContext<{ leagueId: string }>): Promise<Response> {
  return handle(async () => {
    const { leagueId } = await context.params;
    const { season } = parseQuery(request, espnQuerySchema);
    const credential = await loadCredential("espn");
    const cookies = credential && credential.provider === "espn" ? { swid: credential.data.swid, espnS2: credential.data.espnS2 } : null;
    const league = await getLeagueDraft(season, leagueId, cookies);
    return jsonOk({ league, mapped: mapEspnSettings(league), teams: mapEspnTeams(league, cookies ? cookies.swid : ""), authenticated: cookies !== null });
  });
}
