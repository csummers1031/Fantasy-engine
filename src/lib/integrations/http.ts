import { AppError, retry, withTimeout } from "@/lib/errors";

export interface HttpRequestOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
  method?: "GET" | "POST";
  body?: string;
  retries?: number;
}

export async function fetchJson<T>(url: string, options: HttpRequestOptions = {}): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 10000;
  const attempts = options.retries ?? 2;
  return retry(
    async () => {
      const response = await withTimeout(
        fetch(url, {
          method: options.method ?? "GET",
          headers: { Accept: "application/json", ...(options.headers ?? {}) },
          body: options.body,
          cache: "no-store",
        }),
        timeoutMs,
        `GET ${url}`,
      ).catch((error: unknown) => {
        throw new AppError("PROVIDER_HTTP", `Network failure for ${url}`, { cause: error, retryable: true, details: { url } });
      });
      if (response.status === 401 || response.status === 403) {
        const body = (await response.text().catch(() => "")).replace(/\s+/g, " ").trim().slice(0, 300);
        throw new AppError("PROVIDER_AUTH", `Upstream rejected credentials (${response.status})${body ? `: ${body}` : ""}`, { details: { url, status: response.status, body } });
      }
      if (response.status === 404) {
        throw new AppError("NOT_FOUND", `Upstream resource not found`, { details: { url, status: 404 } });
      }
      if (!response.ok) {
        throw new AppError("PROVIDER_HTTP", `Upstream returned ${response.status}`, {
          retryable: response.status >= 500 || response.status === 429,
          details: { url, status: response.status },
        });
      }
      const text = await response.text();
      try {
        return JSON.parse(text) as T;
      } catch (error) {
        throw new AppError("PROVIDER_PARSE", `Upstream returned non-JSON body`, { cause: error, details: { url, preview: text.slice(0, 200) } });
      }
    },
    { attempts, baseDelayMs: 300 },
  );
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function asNumber(value: unknown, fallback: number = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return fallback;
}

export function asString(value: unknown, fallback: string = ""): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return String(value);
  }
  return fallback;
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
