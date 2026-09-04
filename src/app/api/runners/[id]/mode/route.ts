import { handle, jsonOk, parseBody, type RouteContext } from "@/lib/api/respond";
import { runnerModeSchema } from "@/lib/api/schemas";
import { setRunnerMode } from "@/lib/automation/manager";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: RouteContext<{ id: string }>): Promise<Response> {
  return handle(async () => {
    const { id } = await context.params;
    const input = await parseBody(request, runnerModeSchema);
    return jsonOk(await setRunnerMode(id, input.mode, input.reason));
  });
}
