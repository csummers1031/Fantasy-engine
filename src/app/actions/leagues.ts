"use server";

import { revalidatePath } from "next/cache";
import { createLeagueSchema, leagueSettingsSchema } from "@/lib/api/schemas";
import { AppError } from "@/lib/errors";
import { createLeague, deleteLeague, syncLeague } from "@/lib/leagues/service";
import type { Provider } from "@/lib/types";

export interface ActionState {
  ok: boolean;
  message: string;
  leagueId: string;
}

export async function addLeagueAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const raw = {
    provider: String(formData.get("provider") ?? ""),
    externalLeagueId: String(formData.get("externalLeagueId") ?? "").trim(),
    name: String(formData.get("name") ?? "").trim(),
    season: Number(formData.get("season") ?? new Date().getFullYear()),
    draftId: String(formData.get("draftId") ?? "").trim(),
    userTeamId: String(formData.get("userTeamId") ?? "").trim(),
  };
  const settingsJson = String(formData.get("settingsJson") ?? "").trim();
  let settings: ReturnType<typeof leagueSettingsSchema.parse> | undefined;
  if (settingsJson !== "") {
    try {
      const parsedSettings = leagueSettingsSchema.safeParse(JSON.parse(settingsJson));
      if (!parsedSettings.success) {
        return { ok: false, message: `Preset settings invalid: ${parsedSettings.error.issues.map((issue) => issue.message).join("; ")}`, leagueId: "" };
      }
      settings = parsedSettings.data;
    } catch {
      return { ok: false, message: "Preset settings are not valid JSON", leagueId: "" };
    }
  }
  const parsed = createLeagueSchema.safeParse(settings ? { ...raw, settings } : raw);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "), leagueId: "" };
  }
  try {
    const result = await createLeague(parsed.data);
    revalidatePath(`/leagues/${parsed.data.provider}`);
    revalidatePath("/");
    const message = result.syncError !== "" ? `League saved. Sync warning: ${result.syncError}` : `League ${result.league.name} synced (${result.state?.picks.length ?? 0} picks).`;
    return { ok: true, message, leagueId: result.league.id };
  } catch (error) {
    return { ok: false, message: AppError.from(error).message, leagueId: "" };
  }
}

export async function syncLeagueAction(leagueId: string, provider: Provider): Promise<ActionState> {
  try {
    const result = await syncLeague(leagueId);
    revalidatePath(`/leagues/${provider}`);
    revalidatePath(`/war-room/${leagueId}`);
    return { ok: result.syncError === "", message: result.syncError === "" ? "Synced" : result.syncError, leagueId };
  } catch (error) {
    return { ok: false, message: AppError.from(error).message, leagueId };
  }
}

export async function deleteLeagueAction(leagueId: string, provider: Provider): Promise<ActionState> {
  try {
    const deleted = await deleteLeague(leagueId);
    revalidatePath(`/leagues/${provider}`);
    revalidatePath("/");
    return { ok: deleted, message: deleted ? "Deleted" : "League not found", leagueId };
  } catch (error) {
    return { ok: false, message: AppError.from(error).message, leagueId };
  }
}
