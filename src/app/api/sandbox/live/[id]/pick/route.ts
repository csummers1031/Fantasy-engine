import { handle, jsonOk, parseBody, type RouteContext } from "@/lib/api/respond";
import { sandboxPickSchema } from "@/lib/api/schemas";
import { getLiveSandbox } from "@/lib/sandbox/registry";
import { findRunnerForLeague } from "@/lib/automation/manager";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: RouteContext<{ id: string }>): Promise<Response> {
  return handle(async () => {
    const { id } = await context.params;
    const input = await parseBody(request, sandboxPickSchema);
    const draft = getLiveSandbox(id);
    const runner = findRunnerForLeague(`lg_${id}`);
    if (runner) {
      runner.registerManualPick();
    }
    const pick = draft.makeUserPick(input.playerId);
    return jsonOk(pick);
  });
}
