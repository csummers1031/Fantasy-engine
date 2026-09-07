import { z } from "zod";
import { handle, jsonOk, parseBody } from "@/lib/api/respond";
import { getLiveSession } from "@/lib/automation/browser";
import { captureFrameTrees } from "@/lib/automation/dom-snapshot";
import { listSnapshots, saveSnapshot } from "@/lib/automation/snapshot-store";
import { AppError } from "@/lib/errors";
import { parseDraftDom } from "@/lib/integrations/yahoo/dom-parser";

export const dynamic = "force-dynamic";

const schema = z.object({ sessionId: z.string().min(1) });

export async function GET(): Promise<Response> {
  return handle(async () => jsonOk(await listSnapshots()));
}

export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const { sessionId } = await parseBody(request, schema);
    const session = getLiveSession(sessionId);
    if (!session) {
      throw new AppError("NOT_FOUND", `Browser session ${sessionId} is not open`);
    }
    const page = session.page;
    const frames = await captureFrameTrees(page);
    const html = await page.content().catch(() => "");
    const title = await page.title().catch(() => "");
    const record = await saveSnapshot(session.record.provider, page.url(), title, frames, html);
    const parsed = parseDraftDom({ tag: "root", text: "", attrs: {}, children: frames });
    return jsonOk({
      snapshot: record,
      parsed: {
        picks: parsed.picks.length,
        firstPicks: parsed.picks.slice(0, 5),
        secondsRemaining: parsed.secondsRemaining,
        onClockTeamName: parsed.onClockTeamName,
        userTeamName: parsed.userTeamName,
        available: parsed.available.length,
      },
    });
  });
}
