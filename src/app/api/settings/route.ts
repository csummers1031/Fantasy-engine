import { handle, jsonOk, parseBody } from "@/lib/api/respond";
import { settingsSchema } from "@/lib/api/schemas";
import { settingsTable } from "@/lib/db/tables";
import { DEFAULT_SETTINGS } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return handle(async () => {
    const stored = await settingsTable.get("global");
    return jsonOk(stored ?? DEFAULT_SETTINGS);
  });
}

export async function PATCH(request: Request): Promise<Response> {
  return handle(async () => {
    const patch = await parseBody(request, settingsSchema);
    const current = (await settingsTable.get("global")) ?? DEFAULT_SETTINGS;
    const updated = await settingsTable.upsert({
      ...current,
      audioAlerts: patch.audioAlerts ?? current.audioAlerts,
      defaultSafeBufferSeconds: patch.defaultSafeBufferSeconds ?? current.defaultSafeBufferSeconds,
      defaultPollIntervalMs: patch.defaultPollIntervalMs ?? current.defaultPollIntervalMs,
      updatedAt: Date.now(),
    });
    return jsonOk(updated);
  });
}
