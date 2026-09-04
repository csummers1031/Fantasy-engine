import { handle, jsonOk, parseBody } from "@/lib/api/respond";
import { yahooTokenSchema } from "@/lib/api/schemas";
import { saveCredential } from "@/lib/db/credentials";
import { exchangeCodeForToken, resolveYahooConfig } from "@/lib/integrations/yahoo";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const input = await parseBody(request, yahooTokenSchema);
    const config = resolveYahooConfig({ consumerKey: input.consumerKey, consumerSecret: input.consumerSecret, redirectUri: input.redirectUri });
    const token = await exchangeCodeForToken(config, input.code);
    const expiresAt = Date.now() + token.expires_in * 1000;
    await saveCredential(
      {
        provider: "yahoo",
        data: {
          consumerKey: input.consumerKey,
          consumerSecret: input.consumerSecret,
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
