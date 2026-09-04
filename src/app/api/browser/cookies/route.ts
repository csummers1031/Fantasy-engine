import { handle, jsonOk, parseBody } from "@/lib/api/respond";
import { browserCookiesSchema } from "@/lib/api/schemas";
import { extractCookies, getLiveSession } from "@/lib/automation/browser";
import { saveCredential } from "@/lib/db/credentials";
import { AppError } from "@/lib/errors";
import { cookiesFromBrowser } from "@/lib/integrations/espn";
import { maskSecret } from "@/lib/db/crypto";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const input = await parseBody(request, browserCookiesSchema);
    const session = getLiveSession(input.sessionId);
    if (!session) {
      throw new AppError("NOT_FOUND", `Browser session ${input.sessionId} is not open`);
    }
    const cookies = await extractCookies(input.sessionId, session.record.provider === "espn" ? "espn" : "");
    let saved = false;
    let espn: { swid: string; espnS2: string } | null = null;
    if (session.record.provider === "espn") {
      espn = cookiesFromBrowser(cookies);
      if (espn && input.save) {
        await saveCredential({ provider: "espn", data: { swid: espn.swid, espnS2: espn.espnS2 } }, "browser");
        saved = true;
      }
    }
    return jsonOk({
      provider: session.record.provider,
      count: cookies.length,
      names: cookies.map((cookie) => cookie.name),
      espn: espn ? { swid: espn.swid, espnS2: maskSecret(espn.espnS2, 6) } : null,
      saved,
    });
  });
}
