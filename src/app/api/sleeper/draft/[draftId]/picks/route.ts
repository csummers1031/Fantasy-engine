import { handle, jsonOk, type RouteContext } from "@/lib/api/respond";
import { getDraft, getDraftPicks } from "@/lib/integrations/sleeper";
import { coordinatesForOverall, picksUntilUserTurn } from "@/lib/engine/snake";
import { z } from "zod";
import { parseQuery } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const querySchema = z.object({ slot: z.coerce.number().int().min(1).max(32).optional() });

export async function GET(request: Request, context: RouteContext<{ draftId: string }>): Promise<Response> {
  return handle(async () => {
    const { draftId } = await context.params;
    const query = parseQuery(request, querySchema);
    const [draft, picks] = await Promise.all([getDraft(draftId), getDraftPicks(draftId)]);
    const teams = draft.settings.teams;
    const currentOverall = Math.min(teams * draft.settings.rounds, picks.length + 1);
    const current = coordinatesForOverall(currentOverall, teams, draft.type);
    const untilUser = query.slot ? picksUntilUserTurn(currentOverall, query.slot, teams, draft.settings.rounds, draft.type) : -1;
    return jsonOk({ draft, picks, tracking: { currentOverall, current, picksUntilUserTurn: untilUser } });
  });
}
