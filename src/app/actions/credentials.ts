"use server";

import { revalidatePath } from "next/cache";
import { credentialSchema } from "@/lib/api/schemas";
import { deleteCredential, saveCredential } from "@/lib/db/credentials";
import { AppError } from "@/lib/errors";
import { normalizeSwid, parseCookieHeader } from "@/lib/integrations/espn";
import { getUserByUsername } from "@/lib/integrations/sleeper";
import type { CredentialPayload, Provider } from "@/lib/types";

export interface CredentialActionState {
  ok: boolean;
  message: string;
}

export async function saveCredentialAction(_previous: CredentialActionState, formData: FormData): Promise<CredentialActionState> {
  const provider = String(formData.get("provider") ?? "") as Provider;
  try {
    if (provider === "espn" && String(formData.get("cookieHeader") ?? "").trim() !== "") {
      const cookies = parseCookieHeader(String(formData.get("cookieHeader")));
      await saveCredential({ provider: "espn", data: cookies }, "default");
      revalidatePath("/leagues/espn");
      revalidatePath("/settings");
      return { ok: true, message: "ESPN cookies saved from cookie header." };
    }
    const raw: Record<string, unknown> = { provider };
    formData.forEach((value, key) => {
      if (key !== "provider" && typeof value === "string" && value.trim() !== "") {
        raw[key] = key === "expiresAt" ? Number(value) : value.trim();
      }
    });
    const parsed = credentialSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ") };
    }
    const input = parsed.data;
    let payload: CredentialPayload;
    if (input.provider === "sleeper") {
      let userId = input.userId;
      if (userId === "") {
        userId = (await getUserByUsername(input.username)).user_id;
      }
      payload = { provider: "sleeper", data: { username: input.username, userId } };
    } else if (input.provider === "espn") {
      payload = { provider: "espn", data: { swid: normalizeSwid(input.swid), espnS2: input.espnS2 } };
    } else {
      payload = { provider: "yahoo", data: { consumerKey: input.consumerKey, consumerSecret: input.consumerSecret, accessToken: input.accessToken, refreshToken: input.refreshToken, expiresAt: input.expiresAt } };
    }
    await saveCredential(payload, input.label);
    revalidatePath(`/leagues/${provider}`);
    revalidatePath("/settings");
    return { ok: true, message: `${provider} credentials saved and encrypted.` };
  } catch (error) {
    return { ok: false, message: AppError.from(error).message };
  }
}

export async function deleteCredentialAction(id: string): Promise<CredentialActionState> {
  try {
    const deleted = await deleteCredential(id);
    revalidatePath("/settings");
    return { ok: deleted, message: deleted ? "Credential removed." : "Credential not found." };
  } catch (error) {
    return { ok: false, message: AppError.from(error).message };
  }
}
