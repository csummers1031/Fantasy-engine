export type ErrorCode =
  | "VALIDATION"
  | "NOT_FOUND"
  | "PROVIDER_HTTP"
  | "PROVIDER_PARSE"
  | "PROVIDER_AUTH"
  | "STORE_IO"
  | "CRYPTO"
  | "BROWSER_LAUNCH"
  | "SELECTOR_FAILURE"
  | "RUNNER_STATE"
  | "TIMEOUT"
  | "UNSUPPORTED_RUNTIME"
  | "INTERNAL";

export interface AppErrorShape {
  code: ErrorCode;
  message: string;
  details: Record<string, unknown>;
  retryable: boolean;
  cause: string;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly details: Record<string, unknown>;
  readonly retryable: boolean;
  readonly causeMessage: string;

  constructor(code: ErrorCode, message: string, options: { details?: Record<string, unknown>; retryable?: boolean; cause?: unknown } = {}) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.details = options.details ?? {};
    this.retryable = options.retryable ?? false;
    this.causeMessage = describeUnknown(options.cause);
  }

  toJSON(): AppErrorShape {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      retryable: this.retryable,
      cause: this.causeMessage,
    };
  }

  static from(error: unknown, fallbackCode: ErrorCode = "INTERNAL"): AppError {
    if (error instanceof AppError) {
      return error;
    }
    if (error instanceof Error) {
      return new AppError(fallbackCode, error.message, { cause: error });
    }
    return new AppError(fallbackCode, describeUnknown(error));
  }
}

export function describeUnknown(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }
  if (value instanceof Error) {
    return `${value.name}: ${value.message}`;
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export type Result<T, E = AppError> = { ok: true; value: T } | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function fail<E = AppError>(error: E): Result<never, E> {
  return { ok: false, error };
}

export async function isolate<T>(operation: () => Promise<T>, fallbackCode: ErrorCode = "INTERNAL"): Promise<Result<T>> {
  try {
    const value = await operation();
    return ok(value);
  } catch (error) {
    return fail(AppError.from(error, fallbackCode));
  }
}

export function isolateSync<T>(operation: () => T, fallbackCode: ErrorCode = "INTERNAL"): Result<T> {
  try {
    return ok(operation());
  } catch (error) {
    return fail(AppError.from(error, fallbackCode));
  }
}

export function unwrap<T>(result: Result<T>): T {
  if (result.ok) {
    return result.value;
  }
  throw result.error;
}

export async function withTimeout<T>(operation: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new AppError("TIMEOUT", `${label} timed out after ${timeoutMs}ms`, { retryable: true, details: { timeoutMs } }));
    }, timeoutMs);
  });
  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

export interface RetryOptions {
  attempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  shouldRetry: (error: AppError) => boolean;
}

export const DEFAULT_RETRY: RetryOptions = {
  attempts: 3,
  baseDelayMs: 250,
  maxDelayMs: 4000,
  shouldRetry: (error) => error.retryable,
};

export async function retry<T>(operation: () => Promise<T>, options: Partial<RetryOptions> = {}): Promise<T> {
  const settings: RetryOptions = { ...DEFAULT_RETRY, ...options };
  let lastError: AppError = new AppError("INTERNAL", "retry never executed");
  for (let attempt = 1; attempt <= settings.attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = AppError.from(error);
      if (attempt === settings.attempts || !settings.shouldRetry(lastError)) {
        throw lastError;
      }
      const delay = Math.min(settings.maxDelayMs, settings.baseDelayMs * 2 ** (attempt - 1));
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

export function httpErrorResponse(error: unknown): { status: number; body: AppErrorShape } {
  const appError = AppError.from(error);
  const status = statusForCode(appError.code);
  return { status, body: appError.toJSON() };
}

export function statusForCode(code: ErrorCode): number {
  switch (code) {
    case "VALIDATION":
      return 400;
    case "NOT_FOUND":
      return 404;
    case "PROVIDER_AUTH":
      return 401;
    case "PROVIDER_HTTP":
    case "PROVIDER_PARSE":
      return 502;
    case "TIMEOUT":
      return 504;
    case "UNSUPPORTED_RUNTIME":
      return 501;
    case "RUNNER_STATE":
    case "SELECTOR_FAILURE":
    case "BROWSER_LAUNCH":
      return 409;
    case "STORE_IO":
    case "CRYPTO":
    case "INTERNAL":
      return 500;
  }
}
