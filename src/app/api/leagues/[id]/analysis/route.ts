import { z } from "zod";
import { handle, jsonOk, parseQuery, type RouteContext } from "@/lib/api/respond";
import { analysisForLeague } from "@/lib/leagues/service";

export const dynamic = "force-dynamic";

const querySchema = z.object({ force: z.enum(["0", "1"]).default("0") });

export async function GET(request: Request, context: RouteContext<{ id: string }>): Promise<Response> {
  return handle(async () => {
    const { id } = await context.params;
    const query = parseQuery(request, querySchema);
    return jsonOk(await analysisForLeague(id, undefined, query.force === "1"));
  });
}
