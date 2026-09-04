import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError, httpErrorResponse } from "@/lib/errors";

export function jsonOk<T>(value: T, init: ResponseInit = {}): NextResponse {
  return NextResponse.json({ ok: true, data: value }, { status: 200, ...init });
}

export function jsonError(error: unknown): NextResponse {
  const { status, body } = httpErrorResponse(error);
  return NextResponse.json({ ok: false, error: body }, { status });
}

export async function handle(operation: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await operation();
  } catch (error) {
    return jsonError(error);
  }
}

export async function parseBody<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new AppError("VALIDATION", "Request body must be valid JSON");
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new AppError("VALIDATION", "Request body failed validation", { details: { issues: result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) } });
  }
  return result.data;
}

export function parseQuery<T>(request: Request, schema: z.ZodType<T>): T {
  const url = new URL(request.url);
  const entries: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    entries[key] = value;
  });
  const result = schema.safeParse(entries);
  if (!result.success) {
    throw new AppError("VALIDATION", "Query parameters failed validation", { details: { issues: result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) } });
  }
  return result.data;
}

export type RouteContext<T extends Record<string, string>> = { params: Promise<T> };
