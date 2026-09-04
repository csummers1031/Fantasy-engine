import { handle, jsonOk, type RouteContext } from "@/lib/api/respond";
import { getRunner, stopRunner } from "@/lib/automation/manager";
import { runnersTable } from "@/lib/db/tables";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: RouteContext<{ id: string }>): Promise<Response> {
  return handle(async () => {
    const { id } = await context.params;
    try {
      const runner = getRunner(id);
      return jsonOk({ runner: runner.record, snapshot: runner.snapshot, live: true, source: runner.source });
    } catch {
      const stored = await runnersTable.require(id);
      return jsonOk({ runner: stored, snapshot: null, live: false, source: "" });
    }
  });
}

export async function DELETE(_request: Request, context: RouteContext<{ id: string }>): Promise<Response> {
  return handle(async () => {
    const { id } = await context.params;
    return jsonOk(await stopRunner(id));
  });
}
