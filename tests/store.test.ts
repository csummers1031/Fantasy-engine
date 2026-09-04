import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Table, resetDataDirCache } from "@/lib/db/store";
import { decryptJson, encryptJson, maskSecret } from "@/lib/db/crypto";
import { loadCredential, saveCredential, listCredentialSummaries, deleteCredential } from "@/lib/db/credentials";

interface Row {
  id: string;
  value: number;
}

let dir = "";

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "fantasy-engine-test-"));
  process.env.FANTASY_ENGINE_DATA_DIR = dir;
  resetDataDirCache();
});

afterEach(async () => {
  resetDataDirCache();
  await fs.rm(dir, { recursive: true, force: true });
});

describe("json table store", () => {
  it("upserts, reads, updates, and removes rows atomically", async () => {
    const table = new Table<Row>("rows");
    await table.upsert({ id: "a", value: 1 });
    await table.upsert({ id: "b", value: 2 });
    await table.update("a", (row) => ({ ...row, value: 10 }));
    expect((await table.get("a"))?.value).toBe(10);
    expect(await table.all()).toHaveLength(2);
    expect(await table.remove("b")).toBe(true);
    expect(await table.remove("b")).toBe(false);
    const raw = JSON.parse(await fs.readFile(path.join(dir, "rows.json"), "utf8")) as { rows: Row[] };
    expect(raw.rows).toEqual([{ id: "a", value: 10 }]);
  });

  it("serializes concurrent writers", async () => {
    const table = new Table<Row>("counter");
    await table.upsert({ id: "c", value: 0 });
    await Promise.all(Array.from({ length: 25 }, () => table.update("c", (row) => ({ ...row, value: row.value + 1 }))));
    expect((await table.get("c"))?.value).toBe(25);
  });

  it("throws NOT_FOUND on require", async () => {
    const table = new Table<Row>("missing");
    await expect(table.require("nope")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("credential crypto", () => {
  it("round trips AES-GCM payloads and rejects tampering", () => {
    const encrypted = encryptJson({ secret: "value" }, "passphrase-with-enough-length");
    expect(decryptJson<{ secret: string }>(encrypted, "passphrase-with-enough-length").secret).toBe("value");
    const tampered = `${encrypted.slice(0, -2)}AA`;
    expect(() => decryptJson(tampered, "passphrase-with-enough-length")).toThrow();
    expect(() => decryptJson(encrypted, "different-passphrase-length-ok")).toThrow();
    expect(maskSecret("abcdefgh")).toBe("****efgh");
  });

  it("stores credentials encrypted on disk and lists masked summaries", async () => {
    await saveCredential({ provider: "espn", data: { swid: "{ABC-123}", espnS2: "supersecretcookievalue" } }, "default");
    const raw = await fs.readFile(path.join(dir, "credentials.json"), "utf8");
    expect(raw).not.toContain("supersecretcookievalue");
    const loaded = await loadCredential("espn");
    expect(loaded?.provider).toBe("espn");
    if (loaded?.provider === "espn") {
      expect(loaded.data.espnS2).toBe("supersecretcookievalue");
    }
    const summaries = await listCredentialSummaries();
    expect(summaries[0]?.masked.espnS2).toMatch(/^\*+alue$/);
    expect(await deleteCredential(summaries[0]!.id)).toBe(true);
    expect(await loadCredential("espn")).toBeNull();
  });
});
