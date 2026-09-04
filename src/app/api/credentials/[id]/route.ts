import { handle, jsonOk, type RouteContext } from "@/lib/api/respond";
import { deleteCredential } from "@/lib/db/credentials";

export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, context: RouteContext<{ id: string }>): Promise<Response> {
  return handle(async () => {
    const { id } = await context.params;
    return jsonOk({ deleted: await deleteCredential(id) });
  });
}
