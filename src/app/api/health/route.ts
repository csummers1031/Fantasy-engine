import { jsonOk } from "@/lib/api/respond";
import { automationCapability } from "@/lib/automation/runtime";
import { resolveDataDir } from "@/lib/db/store";
import { isUsingFallbackPassphrase } from "@/lib/db/crypto";
import { listenerCount } from "@/lib/events/bus";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const capability = automationCapability();
  return jsonOk({
    status: "ok",
    time: Date.now(),
    dataDir: resolveDataDir(),
    automation: capability,
    usingFallbackEncryptionKey: isUsingFallbackPassphrase(),
    streamListeners: listenerCount(),
    version: "1.0.0",
  });
}
