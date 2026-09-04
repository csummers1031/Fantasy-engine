import { history, subscribe } from "@/lib/events/bus";
import type { EngineEvent } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function encode(event: EngineEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const since = Number(url.searchParams.get("since") ?? "0");
  const encoder = new TextEncoder();
  let unsubscribe: () => void = () => undefined;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: EngineEvent): void => {
        try {
          controller.enqueue(encoder.encode(encode(event)));
        } catch {
          unsubscribe();
        }
      };
      controller.enqueue(encoder.encode(`retry: 2000\n\n`));
      for (const event of history({ since: Number.isFinite(since) ? since : 0, limit: 100 })) {
        send(event);
      }
      unsubscribe = subscribe(send);
      heartbeat = setInterval(() => send({ type: "heartbeat", at: Date.now() }), 15000);
      request.signal.addEventListener("abort", () => {
        unsubscribe();
        if (heartbeat) {
          clearInterval(heartbeat);
        }
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
    cancel() {
      unsubscribe();
      if (heartbeat) {
        clearInterval(heartbeat);
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
