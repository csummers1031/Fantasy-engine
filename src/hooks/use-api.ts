"use client";

import { useCallback, useState } from "react";
import type { AppErrorShape } from "@/lib/errors";

export interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: AppErrorShape;
}

export async function apiRequest<T>(input: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
    cache: "no-store",
  });
  const envelope = (await response.json()) as ApiEnvelope<T>;
  if (!envelope.ok || envelope.data === undefined) {
    throw new Error(envelope.error ? `${envelope.error.code}: ${envelope.error.message}` : `Request failed with ${response.status}`);
  }
  return envelope.data;
}

export function useApiAction<TArgs extends unknown[], TResult>(action: (...args: TArgs) => Promise<TResult>): { run: (...args: TArgs) => Promise<TResult | null>; pending: boolean; error: string; result: TResult | null } {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<TResult | null>(null);
  const run = useCallback(
    async (...args: TArgs): Promise<TResult | null> => {
      setPending(true);
      setError("");
      try {
        const value = await action(...args);
        setResult(value);
        return value;
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
        return null;
      } finally {
        setPending(false);
      }
    },
    [action],
  );
  return { run, pending, error, result };
}
