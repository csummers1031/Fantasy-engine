import { z } from "zod";
import { handle, jsonOk, parseBody, type RouteContext } from "@/lib/api/respond";
import { closeSession, navigate } from "@/lib/automation/browser";

export const dynamic = "force-dynamic";

const navigateSchema = z.object({ url: z.string().url() });

export async function POST(request: Request, context: RouteContext<{ id: string }>): Promise<Response> {
  return handle(async () => {
    const { id } = await context.params;
    const input = await parseBody(request, navigateSchema);
    await navigate(id, input.url);
    return jsonOk({ navigated: true, url: input.url });
  });
}

export async function DELETE(_request: Request, context: RouteContext<{ id: string }>): Promise<Response> {
  return handle(async () => {
    const { id } = await context.params;
    return jsonOk({ closed: await closeSession(id) });
  });
}
