"use client";

import { Button } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-lg border border-desk-down/40 bg-desk-down/10 p-4 text-xs">
      <div className="text-sm font-semibold text-red-200">Page failed to render</div>
      <div className="font-mono text-[11px] text-red-100">{error.message}</div>
      <Button size="sm" variant="outline" onClick={reset}>
        Retry
      </Button>
    </div>
  );
}
