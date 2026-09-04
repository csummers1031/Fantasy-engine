import { handle, jsonOk, parseBody } from "@/lib/api/respond";
import { yahooDomSchema } from "@/lib/api/schemas";
import { defaultYahooSettings, draftStateFromDomHtml, parseDraftHtml } from "@/lib/integrations/yahoo";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const input = await parseBody(request, yahooDomSchema);
    const snapshot = parseDraftHtml(input.html);
    const state = draftStateFromDomHtml(input.leagueKey, input.html, defaultYahooSettings(input.teams), []);
    return jsonOk({ snapshot, state });
  });
}
