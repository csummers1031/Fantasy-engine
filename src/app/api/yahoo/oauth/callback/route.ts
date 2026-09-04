import { z } from "zod";
import { NextResponse } from "next/server";
import { handle, parseQuery } from "@/lib/api/respond";
import { loadCredential, saveCredential } from "@/lib/db/credentials";
import { AppError } from "@/lib/errors";
import { exchangeCodeForToken, resolveYahooConfig } from "@/lib/integrations/yahoo";

export const dynamic = "force-dynamic";

const querySchema = z.object({ code: z.string().min(1), state: z.string().default("") });

export async function GET(request: Request): Promise<Response> {
  return handle(async () => {
    const { code } = parseQuery(request, querySchema);
    const credential = await loadCredential("yahoo");
    if (!credential || credential.provider !== "yahoo") {
      throw new AppError("PROVIDER_AUTH", "Save the Yahoo consumer key and secret before completing OAuth");
    }
    const config = resolveYahooConfig({ consumerKey: credential.data.consumerKey, consumerSecret: credential.data.consumerSecret });
    const token = await exchangeCodeForToken(config, code);
    await saveCredential(
      {
        provider: "yahoo",
        data: {
          ...credential.data,
          accessToken: token.access_token,
          refreshToken: token.refresh_token,
          expiresAt: Date.now() + token.expires_in * 1000,
        },
      },
      "oauth",
    );
    const origin = new URL(request.url).origin;
    return NextResponse.redirect(`${origin}/leagues/yahoo?oauth=complete`);
  });
}
