import path from "node:path";
import { promises as fs } from "node:fs";
import type { BrowserContext, Page } from "playwright-core";
import { AppError } from "@/lib/errors";
import { browserSessionsTable } from "@/lib/db/tables";
import { newId } from "@/lib/db/store";
import { publish } from "@/lib/events/bus";
import type { BrowserSessionRecord, Provider } from "@/lib/types";
import { automationCapability, findFreePort, providerHomeUrl } from "./runtime";

interface LiveSession {
  record: BrowserSessionRecord;
  context: BrowserContext;
  page: Page;
}

declare global {
  var __fantasyEngineBrowserSessions: Map<string, LiveSession> | undefined;
}

function sessions(): Map<string, LiveSession> {
  if (!globalThis.__fantasyEngineBrowserSessions) {
    globalThis.__fantasyEngineBrowserSessions = new Map();
  }
  return globalThis.__fantasyEngineBrowserSessions;
}

export function profileDirFor(provider: Provider): string {
  const base = process.env.FANTASY_ENGINE_BROWSER_PROFILE_DIR ?? "./.browser-profiles";
  return path.resolve(process.cwd(), base, provider);
}

export async function launchPersistentSession(provider: Provider, targetUrl: string = "", headless: boolean = false): Promise<BrowserSessionRecord> {
  const capability = automationCapability();
  if (!capability.supported) {
    throw new AppError("UNSUPPORTED_RUNTIME", capability.reason);
  }
  const existing = [...sessions().values()].find((session) => session.record.provider === provider && session.record.status === "open");
  if (existing) {
    if (targetUrl !== "") {
      await existing.page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => undefined);
      existing.record.targetUrl = targetUrl;
      await browserSessionsTable.upsert(existing.record);
    }
    return existing.record;
  }
  const profileDir = profileDirFor(provider);
  await fs.mkdir(profileDir, { recursive: true });
  const port = await findFreePort(Number(process.env.FANTASY_ENGINE_DEBUG_PORT_BASE ?? "9222"));
  const url = targetUrl !== "" ? targetUrl : providerHomeUrl(provider);
  const record: BrowserSessionRecord = {
    id: newId("bs"),
    provider,
    profileDir,
    remoteDebuggingPort: port,
    startedAt: Date.now(),
    status: "launching",
    lastError: "",
    targetUrl: url,
  };
  await browserSessionsTable.upsert(record);
  try {
    const { chromium } = await import("playwright-core");
    const context = await chromium.launchPersistentContext(profileDir, {
      headless,
      executablePath: capability.executablePath,
      args: [`--remote-debugging-port=${port}`, "--remote-debugging-address=127.0.0.1", "--no-first-run", "--no-default-browser-check", "--disable-blink-features=AutomationControlled"],
      viewport: { width: 1480, height: 960 },
      ignoreDefaultArgs: ["--enable-automation"],
    });
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => undefined);
    record.status = "open";
    context.on("close", () => {
      record.status = "closed";
      sessions().delete(record.id);
      void browserSessionsTable.upsert(record);
      publish({ type: "browser.session", sessionId: record.id, provider, port, status: "closed", at: Date.now() });
    });
    sessions().set(record.id, { record, context, page });
    await browserSessionsTable.upsert(record);
    publish({ type: "browser.session", sessionId: record.id, provider, port, status: "open", at: Date.now() });
    return record;
  } catch (error) {
    record.status = "error";
    record.lastError = error instanceof Error ? error.message : String(error);
    await browserSessionsTable.upsert(record);
    throw new AppError("BROWSER_LAUNCH", `Failed to launch persistent browser for ${provider}`, { cause: error, details: { port, profileDir } });
  }
}

export function getLiveSession(sessionId: string): LiveSession | null {
  return sessions().get(sessionId) ?? null;
}

export function getLiveSessionForProvider(provider: Provider): LiveSession | null {
  return [...sessions().values()].find((session) => session.record.provider === provider && session.record.status === "open") ?? null;
}

export async function extractCookies(sessionId: string, domainFilter: string = ""): Promise<Array<{ name: string; value: string; domain: string }>> {
  const session = getLiveSession(sessionId);
  if (!session) {
    throw new AppError("NOT_FOUND", `Browser session ${sessionId} is not open`);
  }
  const cookies = await session.context.cookies();
  return cookies
    .filter((cookie) => domainFilter === "" || cookie.domain.includes(domainFilter))
    .map((cookie) => ({ name: cookie.name, value: cookie.value, domain: cookie.domain }));
}

export async function closeSession(sessionId: string): Promise<boolean> {
  const session = getLiveSession(sessionId);
  if (!session) {
    return false;
  }
  await session.context.close().catch(() => undefined);
  session.record.status = "closed";
  sessions().delete(sessionId);
  await browserSessionsTable.upsert(session.record);
  return true;
}

export async function listSessions(): Promise<BrowserSessionRecord[]> {
  const stored = await browserSessionsTable.all();
  const live = new Set(sessions().keys());
  return stored.map((record) => (record.status === "open" && !live.has(record.id) ? { ...record, status: "closed" as const } : record)).sort((a, b) => b.startedAt - a.startedAt);
}

export async function navigate(sessionId: string, url: string): Promise<void> {
  const session = getLiveSession(sessionId);
  if (!session) {
    throw new AppError("NOT_FOUND", `Browser session ${sessionId} is not open`);
  }
  await session.page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  session.record.targetUrl = url;
  await browserSessionsTable.upsert(session.record);
}
