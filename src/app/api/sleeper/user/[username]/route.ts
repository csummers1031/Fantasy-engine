import { z } from "zod";
import { handle, jsonOk, parseQuery, type RouteContext } from "@/lib/api/respond";
import { getUserByUsername, getUserLeagues } from "@/lib/integrations/sleeper";

export const dynamic = "force-dynamic";

const querySchema = z.object({ season: z.coerce.number().int().min(2015).max(2100).default(new Date().getFullYear()) });

export async function GET(request: Request, context: RouteContext<{ username: string }>): Promise<Response> {
  return handle(async () => {
    const { username } = await context.params;
    const { season } = parseQuery(request, querySchema);
    const user = await getUserByUsername(username);
    const leagues = await getUserLeagues(user.user_id, season);
    return jsonOk({ user, leagues });
  });
}
