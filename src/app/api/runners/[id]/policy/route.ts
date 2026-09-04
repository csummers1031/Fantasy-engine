import { handle, jsonOk, parseBody, type RouteContext } from "@/lib/api/respond";
import { runnerPolicySchema } from "@/lib/api/schemas";
import { updateRunnerPolicy } from "@/lib/automation/manager";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: RouteContext<{ id: string }>): Promise<Response> {
  return handle(async () => {
    const { id } = await context.params;
    const input = await parseBody(request, runnerPolicySchema);
    return jsonOk(await updateRunnerPolicy(id, input));
  });
}
