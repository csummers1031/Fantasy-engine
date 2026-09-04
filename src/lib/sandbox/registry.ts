import { SandboxDraft, type SandboxConfig } from "./simulator";
import { newId } from "@/lib/db/store";
import { AppError } from "@/lib/errors";

declare global {
  var __fantasyEngineSandboxes: Map<string, SandboxDraft> | undefined;
}

function registry(): Map<string, SandboxDraft> {
  if (!globalThis.__fantasyEngineSandboxes) {
    globalThis.__fantasyEngineSandboxes = new Map();
  }
  return globalThis.__fantasyEngineSandboxes;
}

export function createLiveSandbox(config: Partial<SandboxConfig>): SandboxDraft {
  const id = newId("sandbox");
  const draft = new SandboxDraft(id, config);
  registry().set(id, draft);
  draft.startLiveBots();
  return draft;
}

export function getLiveSandbox(id: string): SandboxDraft {
  const draft = registry().get(id);
  if (!draft) {
    throw new AppError("NOT_FOUND", `Sandbox ${id} is not running in this process`);
  }
  return draft;
}

export function findLiveSandbox(id: string): SandboxDraft | null {
  return registry().get(id) ?? null;
}

export function listLiveSandboxes(): SandboxDraft[] {
  return [...registry().values()];
}

export function destroyLiveSandbox(id: string): boolean {
  const draft = registry().get(id);
  if (!draft) {
    return false;
  }
  draft.stopLiveBots();
  registry().delete(id);
  return true;
}
