import { existsSync } from "node:fs";
import net from "node:net";
import path from "node:path";

export const KNOWN_CHROMIUM_PATHS: readonly string[] = [
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
];

export function resolveChromiumExecutable(): string {
  const configured = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? "";
  if (configured !== "" && existsSync(configured)) {
    return configured;
  }
  const browsersPath = process.env.PLAYWRIGHT_BROWSERS_PATH ?? "";
  const candidates = [...KNOWN_CHROMIUM_PATHS];
  if (browsersPath !== "") {
    candidates.unshift(path.join(browsersPath, "chromium-1194", "chrome-linux", "chrome"));
  }
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return "";
}

export function isServerlessRuntime(): boolean {
  return process.env.VERCEL === "1" || process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined || process.env.NEXT_RUNTIME === "edge";
}

export interface AutomationCapability {
  supported: boolean;
  reason: string;
  executablePath: string;
}

export function automationCapability(): AutomationCapability {
  if (isServerlessRuntime()) {
    return { supported: false, reason: "Browser automation requires the local Node runtime. This deployment is serverless.", executablePath: "" };
  }
  const executablePath = resolveChromiumExecutable();
  if (executablePath === "") {
    return { supported: false, reason: "No Chromium executable found. Set PLAYWRIGHT_CHROMIUM_EXECUTABLE.", executablePath: "" };
  }
  return { supported: true, reason: "", executablePath };
}

export async function findFreePort(base: number, attempts: number = 50): Promise<number> {
  for (let offset = 0; offset < attempts; offset += 1) {
    const port = base + offset;
    const free = await new Promise<boolean>((resolve) => {
      const server = net.createServer();
      server.once("error", () => resolve(false));
      server.listen(port, "127.0.0.1", () => {
        server.close(() => resolve(true));
      });
    });
    if (free) {
      return port;
    }
  }
  return new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address !== null ? address.port : base;
      server.close(() => resolve(port));
    });
  });
}

export function providerHomeUrl(provider: "sleeper" | "espn" | "yahoo"): string {
  switch (provider) {
    case "sleeper":
      return "https://sleeper.com/leagues";
    case "espn":
      return "https://fantasy.espn.com/football/";
    case "yahoo":
      return "https://football.fantasysports.yahoo.com/";
  }
}
