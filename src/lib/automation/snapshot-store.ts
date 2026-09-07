import { promises as fs } from "node:fs";
import path from "node:path";
import { AppError } from "@/lib/errors";
import { resolveDataDir, newId } from "@/lib/db/store";
import type { DomNode } from "@/lib/integrations/yahoo/types";
import type { Provider } from "@/lib/types";

export interface DomSnapshotRecord {
  id: string;
  provider: Provider;
  url: string;
  title: string;
  capturedAt: number;
  frameCount: number;
  nodeCount: number;
  file: string;
}

export interface StoredSnapshot extends DomSnapshotRecord {
  frames: DomNode[];
  html: string;
}

function snapshotDir(): string {
  return path.join(resolveDataDir(), "dom-snapshots");
}

export function countNodes(node: DomNode): number {
  let count = 1;
  for (const child of node.children) {
    count += countNodes(child);
  }
  return count;
}

export async function saveSnapshot(provider: Provider, url: string, title: string, frames: DomNode[], html: string): Promise<DomSnapshotRecord> {
  const id = newId("dom");
  const dir = snapshotDir();
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `${provider}-${id}.json`);
  const record: DomSnapshotRecord = {
    id,
    provider,
    url,
    title,
    capturedAt: Date.now(),
    frameCount: frames.length,
    nodeCount: frames.reduce((sum, frame) => sum + countNodes(frame), 0),
    file,
  };
  const stored: StoredSnapshot = { ...record, frames, html };
  await fs.writeFile(file, JSON.stringify(stored), "utf8");
  return record;
}

export async function listSnapshots(): Promise<DomSnapshotRecord[]> {
  const dir = snapshotDir();
  let entries: string[] = [];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }
  const records: DomSnapshotRecord[] = [];
  for (const entry of entries) {
    if (!entry.endsWith(".json")) {
      continue;
    }
    try {
      const raw = JSON.parse(await fs.readFile(path.join(dir, entry), "utf8")) as StoredSnapshot;
      records.push({ id: raw.id, provider: raw.provider, url: raw.url, title: raw.title, capturedAt: raw.capturedAt, frameCount: raw.frameCount, nodeCount: raw.nodeCount, file: raw.file });
    } catch {
      // skip unreadable snapshot files
    }
  }
  return records.sort((a, b) => b.capturedAt - a.capturedAt);
}

export async function readSnapshot(id: string): Promise<StoredSnapshot> {
  const records = await listSnapshots();
  const record = records.find((candidate) => candidate.id === id);
  if (!record) {
    throw new AppError("NOT_FOUND", `Snapshot ${id} not found`);
  }
  return JSON.parse(await fs.readFile(record.file, "utf8")) as StoredSnapshot;
}
