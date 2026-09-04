import { handle, jsonOk } from "@/lib/api/respond";
import { listSessions } from "@/lib/automation/browser";
import { automationCapability } from "@/lib/automation/runtime";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return handle(async () => jsonOk({ sessions: await listSessions(), capability: automationCapability() }));
}
