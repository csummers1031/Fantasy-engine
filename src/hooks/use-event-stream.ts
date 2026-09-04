"use client";

import { useEffect, useRef, useState } from "react";
import type { EngineEvent } from "@/lib/types";

export interface EventStreamState {
  connected: boolean;
  events: EngineEvent[];
  lastEventAt: number;
}

const MAX_BUFFER = 400;

export function useEventStream(onEvent?: (event: EngineEvent) => void): EventStreamState {
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<EngineEvent[]>([]);
  const [lastEventAt, setLastEventAt] = useState(0);
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    let source: EventSource | null = null;
    let closed = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = (): void => {
      if (closed) {
        return;
      }
      source = new EventSource(`/api/stream?since=${Date.now() - 60000}`);
      source.onopen = () => setConnected(true);
      source.onerror = () => {
        setConnected(false);
        if (source) {
          source.close();
          source = null;
        }
        if (!closed) {
          retryTimer = setTimeout(connect, 2000);
        }
      };
      const handler = (message: MessageEvent<string>): void => {
        try {
          const event = JSON.parse(message.data) as EngineEvent;
          setLastEventAt(event.at);
          if (event.type !== "heartbeat") {
            setEvents((previous) => {
              const next = [...previous, event];
              return next.length > MAX_BUFFER ? next.slice(next.length - MAX_BUFFER) : next;
            });
          }
          if (handlerRef.current) {
            handlerRef.current(event);
          }
        } catch {
          // malformed frame is ignored
        }
      };
      const types: EngineEvent["type"][] = ["draft.snapshot", "draft.pick", "run.alert", "runner.status", "runner.mode", "autopilot.action", "selector.failure", "browser.session", "sandbox.progress", "sandbox.complete", "system.notice", "heartbeat"];
      for (const type of types) {
        source.addEventListener(type, handler as EventListener);
      }
    };

    connect();
    return () => {
      closed = true;
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
      if (source) {
        source.close();
      }
    };
  }, []);

  return { connected, events, lastEventAt };
}
