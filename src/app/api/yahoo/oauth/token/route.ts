import { handle, jsonOk, parseBody } from "@/lib/api/respond";
import { yahooTokenSchema } from "@/lib/api/schemas";
import { loadCredential, saveCredential } from "@/lib/db/credentials";
import { AppError } from "@/lib/errors";
import { exchangeCodeForToken, resolveYahooConfig } from "@/lib/integrations/yahoo";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const input = await parseBody(request, yahooTokenSchema);
    const stored = await loadCredential("yahoo");
    const consumerKey = input.consumerKey ?? (stored && stored.provider === "yahoo" ? stored.data.consumerKey : "");
    const consumerSecret = input.consumerSecret ?? (stored && stored.provider === "yahoo" ? stored.data.consumerSecret : "");
    if (consumerKey === "" || consumerSecret === "") {
      throw new AppError("VALIDATION", "Save the Yahoo consumer key and secret before exchanging a code");
    }
    const config = resolveYahooConfig({ consumerKey, consumerSecret, redirectUri: input.redirectUri });
    const token = await exchangeCodeForToken(config, input.code.trim());
    const expiresAt = Date.now() + token.expires_in * 1000;
    await saveCredential(
      {
        provider: "yahoo",
        data: {
          consumerKey,
          consumerSecret,
          accessToken: token.access_token,
          refreshToken: token.refresh_token,
          expiresAt,
        },
      },
      "oauth",
    );
    return jsonOk({ tokenType: token.token_type, expiresAt, hasRefreshToken: token.refresh_token !== "" });
  });
}
