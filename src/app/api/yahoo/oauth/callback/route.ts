import { z } from "zod";
import { NextResponse } from "next/server";
import { handle, parseQuery } from "@/lib/api/respond";
import { loadCredential, saveCredential } from "@/lib/db/credentials";
import { AppError } from "@/lib/errors";
import { exchangeCodeForToken, resolveYahooConfig } from "@/lib/integrations/yahoo";

export const dynamic = "force-dynamic";

const querySchema = z.object({ code: z.string().min(1), state: z.string().default("") });

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function codePage(code: string): NextResponse {
  const safe = escapeHtml(code);
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Yahoo authorization code</title>
<style>body{margin:0;background:#0b0f14;color:#e5e9ef;font-family:-apple-system,Segoe UI,Roboto,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center}
.card{background:#111821;border:1px solid #1f2a37;border-radius:10px;padding:24px;max-width:520px;width:92%}
h1{font-size:16px;margin:0 0 8px}p{font-size:13px;color:#8a96a6;margin:0 0 14px;line-height:1.5}
code{display:block;background:#0b0f14;border:1px solid #38bdf8;border-radius:8px;padding:14px;font-size:22px;font-family:ui-monospace,Menlo,monospace;word-break:break-all;color:#38bdf8}
button{margin-top:12px;background:#38bdf8;color:#0b0f14;border:0;border-radius:6px;padding:9px 14px;font-weight:700;font-size:13px;cursor:pointer}</style></head>
<body><div class="card"><h1>Yahoo authorized</h1><p>Copy this code, go back to the Fantasy Engine tab running on your computer, paste it into the <b>Step 2</b> box on the Yahoo page, and click <b>Exchange code</b>.</p>
<code id="code">${safe}</code><button onclick="navigator.clipboard.writeText(document.getElementById('code').textContent).then(()=>{this.textContent='Copied'})">Copy code</button></div></body></html>`;
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

export async function GET(request: Request): Promise<Response> {
  return handle(async () => {
    const { code } = parseQuery(request, querySchema);
    const url = new URL(request.url);
    const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    const credential = await loadCredential("yahoo");
    if (!isLocal || !credential || credential.provider !== "yahoo") {
      return codePage(code);
    }
    const config = resolveYahooConfig({ consumerKey: credential.data.consumerKey, consumerSecret: credential.data.consumerSecret });
    if (config.consumerKey === "" || config.consumerSecret === "") {
      throw new AppError("PROVIDER_AUTH", "Save the Yahoo consumer key and secret before completing OAuth");
    }
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
    return NextResponse.redirect(`${url.origin}/leagues/yahoo?oauth=complete`);
  });
}
