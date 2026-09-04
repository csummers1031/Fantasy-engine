import { handle, jsonOk, parseBody } from "@/lib/api/respond";
import { browserLaunchSchema } from "@/lib/api/schemas";
import { launchPersistentSession } from "@/lib/automation/browser";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const input = await parseBody(request, browserLaunchSchema);
    const session = await launchPersistentSession(input.provider, input.targetUrl, input.headless);
    return jsonOk(session);
  });
}
