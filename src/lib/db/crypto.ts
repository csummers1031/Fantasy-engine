import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { AppError } from "@/lib/errors";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const SALT = "fantasy-engine-credential-salt-v1";
const FALLBACK_PASSPHRASE = "fantasy-engine-development-only-passphrase";

let cachedKey: Buffer | null = null;
let cachedPassphrase = "";

function deriveKey(passphrase: string): Buffer {
  if (cachedKey && cachedPassphrase === passphrase) {
    return cachedKey;
  }
  cachedKey = scryptSync(passphrase, SALT, KEY_LENGTH);
  cachedPassphrase = passphrase;
  return cachedKey;
}

export function resolvePassphrase(): string {
  const configured = process.env.CREDENTIAL_ENCRYPTION_KEY ?? "";
  if (configured.trim().length >= 16) {
    return configured;
  }
  return FALLBACK_PASSPHRASE;
}

export function isUsingFallbackPassphrase(): boolean {
  return resolvePassphrase() === FALLBACK_PASSPHRASE;
}

export function encryptJson(value: unknown, passphrase: string = resolvePassphrase()): string {
  try {
    const key = deriveKey(passphrase);
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const plaintext = Buffer.from(JSON.stringify(value), "utf8");
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(".");
  } catch (error) {
    throw new AppError("CRYPTO", "Failed to encrypt payload", { cause: error });
  }
}

export function decryptJson<T>(payload: string, passphrase: string = resolvePassphrase()): T {
  const parts = payload.split(".");
  if (parts.length !== 3) {
    throw new AppError("CRYPTO", "Encrypted payload is malformed");
  }
  const [ivPart, tagPart, dataPart] = parts as [string, string, string];
  try {
    const key = deriveKey(passphrase);
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivPart, "base64"));
    decipher.setAuthTag(Buffer.from(tagPart, "base64"));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(dataPart, "base64")), decipher.final()]);
    return JSON.parse(decrypted.toString("utf8")) as T;
  } catch (error) {
    throw new AppError("CRYPTO", "Failed to decrypt payload", { cause: error });
  }
}

export function maskSecret(value: string, visible: number = 4): string {
  if (value.length <= visible) {
    return "*".repeat(value.length);
  }
  return `${"*".repeat(Math.max(0, value.length - visible))}${value.slice(-visible)}`;
}
