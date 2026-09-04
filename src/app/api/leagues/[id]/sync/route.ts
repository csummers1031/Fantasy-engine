import { handle, jsonOk, type RouteContext } from "@/lib/api/respond";
import { syncLeague } from "@/lib/leagues/service";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: RouteContext<{ id: string }>): Promise<Response> {
  return handle(async () => {
    const { id } = await context.params;
    return jsonOk(await syncLeague(id));
  });
}
