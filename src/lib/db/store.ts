import { promises as fs } from "node:fs";
import { accessSync, constants, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { AppError } from "@/lib/errors";

export interface TableRow {
  id: string;
}

interface TableFile<T extends TableRow> {
  version: number;
  rows: T[];
}

type Mutex = { queue: Promise<void> };

declare global {
  var __fantasyEngineStoreMutexes: Map<string, Mutex> | undefined;
}

function mutexRegistry(): Map<string, Mutex> {
  if (!globalThis.__fantasyEngineStoreMutexes) {
    globalThis.__fantasyEngineStoreMutexes = new Map();
  }
  return globalThis.__fantasyEngineStoreMutexes;
}

function isWritable(dir: string): boolean {
  try {
    mkdirSync(dir, { recursive: true });
    accessSync(dir, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

let resolvedDataDir: string | null = null;

export function resolveDataDir(): string {
  if (resolvedDataDir) {
    return resolvedDataDir;
  }
  const configured = process.env.FANTASY_ENGINE_DATA_DIR ?? "./data";
  const candidates = [path.resolve(process.cwd(), configured), path.join(os.tmpdir(), "fantasy-engine-data")];
  for (const candidate of candidates) {
    if (isWritable(candidate)) {
      resolvedDataDir = candidate;
      return candidate;
    }
  }
  resolvedDataDir = path.join(os.tmpdir(), "fantasy-engine-data");
  return resolvedDataDir;
}

export function resetDataDirCache(): void {
  resolvedDataDir = null;
}

async function withLock<T>(name: string, operation: () => Promise<T>): Promise<T> {
  const mutexes = mutexRegistry();
  let mutex = mutexes.get(name);
  if (!mutex) {
    mutex = { queue: Promise.resolve() };
    mutexes.set(name, mutex);
  }
  const previous = mutex.queue;
  let release: () => void = () => undefined;
  mutex.queue = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await operation();
  } finally {
    release();
  }
}

function tablePath(name: string): string {
  return path.join(resolveDataDir(), `${name}.json`);
}

async function readTableFile<T extends TableRow>(name: string): Promise<TableFile<T>> {
  const file = tablePath(name);
  try {
    const raw = await fs.readFile(file, "utf8");
    const parsed = JSON.parse(raw) as TableFile<T>;
    if (!Array.isArray(parsed.rows)) {
      throw new AppError("STORE_IO", `Table ${name} is corrupt`);
    }
    return parsed;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return { version: 1, rows: [] };
    }
    throw new AppError("STORE_IO", `Failed to read table ${name}`, { cause: error, details: { file } });
  }
}

async function writeTableFile<T extends TableRow>(name: string, table: TableFile<T>): Promise<void> {
  const file = tablePath(name);
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  try {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(tmp, JSON.stringify(table, null, 2), "utf8");
    await fs.rename(tmp, file);
  } catch (error) {
    try {
      await fs.unlink(tmp);
    } catch {
      // temp file already gone
    }
    throw new AppError("STORE_IO", `Failed to write table ${name}`, { cause: error, details: { file } });
  }
}

export class Table<T extends TableRow> {
  constructor(readonly name: string) {}

  async all(): Promise<T[]> {
    const table = await readTableFile<T>(this.name);
    return table.rows.map((row) => structuredClone(row));
  }

  async get(id: string): Promise<T | null> {
    const table = await readTableFile<T>(this.name);
    const row = table.rows.find((candidate) => candidate.id === id);
    return row ? structuredClone(row) : null;
  }

  async require(id: string): Promise<T> {
    const row = await this.get(id);
    if (!row) {
      throw new AppError("NOT_FOUND", `${this.name} ${id} not found`, { details: { id } });
    }
    return row;
  }

  async where(predicate: (row: T) => boolean): Promise<T[]> {
    const rows = await this.all();
    return rows.filter(predicate);
  }

  async upsert(row: T): Promise<T> {
    return withLock(this.name, async () => {
      const table = await readTableFile<T>(this.name);
      const index = table.rows.findIndex((candidate) => candidate.id === row.id);
      const next: TableFile<T> = { version: table.version, rows: [...table.rows] };
      if (index >= 0) {
        next.rows[index] = structuredClone(row);
      } else {
        next.rows.push(structuredClone(row));
      }
      await writeTableFile(this.name, next);
      return structuredClone(row);
    });
  }

  async update(id: string, mutate: (row: T) => T): Promise<T> {
    return withLock(this.name, async () => {
      const table = await readTableFile<T>(this.name);
      const index = table.rows.findIndex((candidate) => candidate.id === id);
      if (index < 0) {
        throw new AppError("NOT_FOUND", `${this.name} ${id} not found`, { details: { id } });
      }
      const current = table.rows[index] as T;
      const updated = mutate(structuredClone(current));
      const next: TableFile<T> = { version: table.version, rows: [...table.rows] };
      next.rows[index] = updated;
      await writeTableFile(this.name, next);
      return structuredClone(updated);
    });
  }

  async remove(id: string): Promise<boolean> {
    return withLock(this.name, async () => {
      const table = await readTableFile<T>(this.name);
      const rows = table.rows.filter((candidate) => candidate.id !== id);
      if (rows.length === table.rows.length) {
        return false;
      }
      await writeTableFile(this.name, { version: table.version, rows });
      return true;
    });
  }

  async clear(): Promise<void> {
    return withLock(this.name, async () => {
      await writeTableFile(this.name, { version: 1, rows: [] });
    });
  }
}

export function newId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}${random}`;
}
