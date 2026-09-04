import { handle, jsonOk, parseBody } from "@/lib/api/respond";
import { credentialSchema, espnCookieHeaderSchema } from "@/lib/api/schemas";
import { listCredentialSummaries, saveCredential } from "@/lib/db/credentials";
import { getUserByUsername } from "@/lib/integrations/sleeper";
import { normalizeSwid, parseCookieHeader } from "@/lib/integrations/espn";
import type { CredentialPayload } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return handle(async () => jsonOk(await listCredentialSummaries()));
}

export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const input = await parseBody(request, credentialSchema);
    let payload: CredentialPayload;
    if (input.provider === "sleeper") {
      let userId = input.userId;
      if (userId === "") {
        const user = await getUserByUsername(input.username);
        userId = user.user_id;
      }
      payload = { provider: "sleeper", data: { username: input.username, userId } };
    } else if (input.provider === "espn") {
      payload = { provider: "espn", data: { swid: normalizeSwid(input.swid), espnS2: input.espnS2 } };
    } else {
      payload = {
        provider: "yahoo",
        data: {
          consumerKey: input.consumerKey,
          consumerSecret: input.consumerSecret,
          accessToken: input.accessToken,
          refreshToken: input.refreshToken,
          expiresAt: input.expiresAt,
        },
      };
    }
    const record = await saveCredential(payload, input.label);
    return jsonOk({ id: record.id, provider: record.provider, label: record.label, updatedAt: record.updatedAt });
  });
}

export async function PUT(request: Request): Promise<Response> {
  return handle(async () => {
    const input = await parseBody(request, espnCookieHeaderSchema);
    const cookies = parseCookieHeader(input.cookieHeader);
    const record = await saveCredential({ provider: "espn", data: cookies }, input.label);
    return jsonOk({ id: record.id, provider: record.provider, label: record.label, updatedAt: record.updatedAt });
  });
}
