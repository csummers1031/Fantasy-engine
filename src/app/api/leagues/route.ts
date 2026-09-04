import { handle, jsonOk, parseBody } from "@/lib/api/respond";
import { createLeagueSchema } from "@/lib/api/schemas";
import { createLeague, listLeagues } from "@/lib/leagues/service";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return handle(async () => jsonOk(await listLeagues()));
}

export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const input = await parseBody(request, createLeagueSchema);
    const result = await createLeague(input);
    return jsonOk(result);
  });
}
