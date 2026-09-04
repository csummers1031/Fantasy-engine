import { credentialsTable } from "./tables";
import { newId } from "./store";
import { decryptJson, encryptJson, maskSecret } from "./crypto";
import type { CredentialPayload, CredentialRecord, Provider } from "@/lib/types";
import { AppError } from "@/lib/errors";

export interface CredentialSummary {
  id: string;
  provider: Provider;
  label: string;
  masked: Record<string, string>;
  updatedAt: number;
}

export async function saveCredential(payload: CredentialPayload, label: string): Promise<CredentialRecord> {
  const existing = await credentialsTable.where((row) => row.provider === payload.provider && row.label === label);
  const now = Date.now();
  const record: CredentialRecord = {
    id: existing[0]?.id ?? newId("cred"),
    provider: payload.provider,
    label,
    encryptedPayload: encryptJson(payload),
    createdAt: existing[0]?.createdAt ?? now,
    updatedAt: now,
  };
  return credentialsTable.upsert(record);
}

export async function loadCredential(provider: Provider): Promise<CredentialPayload | null> {
  const rows = await credentialsTable.where((row) => row.provider === provider);
  const latest = rows.sort((a, b) => b.updatedAt - a.updatedAt)[0];
  if (!latest) {
    return null;
  }
  const payload = decryptJson<CredentialPayload>(latest.encryptedPayload);
  if (payload.provider !== provider) {
    throw new AppError("CRYPTO", "Credential provider mismatch", { details: { expected: provider, actual: payload.provider } });
  }
  return payload;
}

export async function listCredentialSummaries(): Promise<CredentialSummary[]> {
  const rows = await credentialsTable.all();
  return rows.map((row) => {
    const masked: Record<string, string> = {};
    try {
      const payload = decryptJson<CredentialPayload>(row.encryptedPayload);
      for (const [key, value] of Object.entries(payload.data)) {
        masked[key] = typeof value === "string" ? maskSecret(value) : String(value);
      }
    } catch {
      masked.error = "undecryptable with current key";
    }
    return { id: row.id, provider: row.provider, label: row.label, masked, updatedAt: row.updatedAt };
  });
}

export async function deleteCredential(id: string): Promise<boolean> {
  return credentialsTable.remove(id);
}
