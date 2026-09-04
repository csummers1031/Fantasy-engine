import { z } from "zod";
import { NextResponse } from "next/server";
import { handle, jsonOk, parseQuery } from "@/lib/api/respond";
import { loadCredential } from "@/lib/db/credentials";
import { newId } from "@/lib/db/store";
import { buildAuthorizeUrl, resolveYahooConfig } from "@/lib/integrations/yahoo";

export const dynamic = "force-dynamic";

const querySchema = z.object({ redirect: z.enum(["0", "1"]).default("0") });

export async function GET(request: Request): Promise<Response> {
  return handle(async () => {
    const { redirect } = parseQuery(request, querySchema);
    const credential = await loadCredential("yahoo");
    const config = resolveYahooConfig(credential && credential.provider === "yahoo" ? { consumerKey: credential.data.consumerKey, consumerSecret: credential.data.consumerSecret } : {});
    const state = newId("state");
    const url = buildAuthorizeUrl(config, state);
    if (redirect === "1") {
      return NextResponse.redirect(url);
    }
    return jsonOk({ url, state, redirectUri: config.redirectUri });
  });
}
