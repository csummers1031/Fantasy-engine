import { handle, jsonOk, parseQuery } from "@/lib/api/respond";
import { eventsQuerySchema } from "@/lib/api/schemas";
import { history } from "@/lib/events/bus";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return handle(async () => {
    const query = parseQuery(request, eventsQuerySchema);
    return jsonOk(history({ since: query.since, limit: query.limit }));
  });
}
