import { SettingsConsole } from "@/components/settings/settings-console";
import { automationCapability } from "@/lib/automation/runtime";
import { listCredentialSummaries } from "@/lib/db/credentials";
import { isUsingFallbackPassphrase } from "@/lib/db/crypto";
import { resolveDataDir } from "@/lib/db/store";
import { settingsTable } from "@/lib/db/tables";
import { listenerCount } from "@/lib/events/bus";
import { DEFAULT_SETTINGS } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [settings, credentials] = await Promise.all([settingsTable.get("global"), listCredentialSummaries()]);
  const health = {
    status: "ok",
    dataDir: resolveDataDir(),
    automation: automationCapability(),
    usingFallbackEncryptionKey: isUsingFallbackPassphrase(),
    streamListeners: listenerCount(),
    version: "1.0.0",
  };
  return <SettingsConsole settings={settings ?? DEFAULT_SETTINGS} credentials={credentials} health={health} />;
}
