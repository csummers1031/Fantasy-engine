import { handle, jsonOk, parseBody, type RouteContext } from "@/lib/api/respond";
import { updateLeagueSchema } from "@/lib/api/schemas";
import { leaguesTable } from "@/lib/db/tables";
import { deleteLeague } from "@/lib/leagues/service";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: RouteContext<{ id: string }>): Promise<Response> {
  return handle(async () => {
    const { id } = await context.params;
    return jsonOk(await leaguesTable.require(id));
  });
}

export async function PATCH(request: Request, context: RouteContext<{ id: string }>): Promise<Response> {
  return handle(async () => {
    const { id } = await context.params;
    const patch = await parseBody(request, updateLeagueSchema);
    const updated = await leaguesTable.update(id, (row) => ({
      ...row,
      name: patch.name ?? row.name,
      draftId: patch.draftId ?? row.draftId,
      userTeamId: patch.userTeamId ?? row.userTeamId,
      settings: patch.settings ?? row.settings,
      updatedAt: Date.now(),
    }));
    return jsonOk(updated);
  });
}

export async function DELETE(_request: Request, context: RouteContext<{ id: string }>): Promise<Response> {
  return handle(async () => {
    const { id } = await context.params;
    return jsonOk({ deleted: await deleteLeague(id) });
  });
}
