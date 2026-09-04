import { handle, jsonOk, type RouteContext } from "@/lib/api/respond";
import { destroyLiveSandbox, getLiveSandbox } from "@/lib/sandbox/registry";
import { findRunnerForLeague } from "@/lib/automation/manager";
import { leaguesTable } from "@/lib/db/tables";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: RouteContext<{ id: string }>): Promise<Response> {
  return handle(async () => {
    const { id } = await context.params;
    const draft = getLiveSandbox(id);
    return jsonOk({ state: draft.state(), available: draft.available().slice(0, 60), userOnClock: draft.isUserOnClock() });
  });
}

export async function DELETE(_request: Request, context: RouteContext<{ id: string }>): Promise<Response> {
  return handle(async () => {
    const { id } = await context.params;
    const runner = findRunnerForLeague(`lg_${id}`);
    if (runner) {
      await runner.stop();
    }
    await leaguesTable.remove(`lg_${id}`);
    return jsonOk({ destroyed: destroyLiveSandbox(id) });
  });
}
