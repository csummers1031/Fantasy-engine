import { handle, jsonOk, type RouteContext } from "@/lib/api/respond";
import { registerManualPick } from "@/lib/automation/manager";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: RouteContext<{ id: string }>): Promise<Response> {
  return handle(async () => {
    const { id } = await context.params;
    return jsonOk(registerManualPick(id));
  });
}
