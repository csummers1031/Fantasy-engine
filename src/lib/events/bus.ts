import type { EngineEvent, EngineEventType } from "@/lib/types";

type Listener = (event: EngineEvent) => void;

interface BusState {
  listeners: Set<Listener>;
  history: EngineEvent[];
  historyLimit: number;
}

declare global {
  var __fantasyEngineBus: BusState | undefined;
}

function getState(): BusState {
  if (!globalThis.__fantasyEngineBus) {
    globalThis.__fantasyEngineBus = { listeners: new Set(), history: [], historyLimit: 500 };
  }
  return globalThis.__fantasyEngineBus;
}

export function publish(event: EngineEvent): void {
  const state = getState();
  state.history.push(event);
  if (state.history.length > state.historyLimit) {
    state.history.splice(0, state.history.length - state.historyLimit);
  }
  for (const listener of state.listeners) {
    try {
      listener(event);
    } catch {
      // A failing subscriber must never break the publisher.
    }
  }
}

export function subscribe(listener: Listener): () => void {
  const state = getState();
  state.listeners.add(listener);
  return () => {
    state.listeners.delete(listener);
  };
}

export function history(filter: { types?: EngineEventType[]; since?: number; limit?: number } = {}): EngineEvent[] {
  const state = getState();
  const since = filter.since ?? 0;
  const types = filter.types;
  const limit = filter.limit ?? 200;
  const matched = state.history.filter((event) => event.at >= since && (!types || types.includes(event.type)));
  return matched.slice(-limit);
}

export function listenerCount(): number {
  return getState().listeners.size;
}

export function notice(level: "info" | "warning" | "critical", message: string, audio: boolean = level === "critical"): void {
  publish({ type: "system.notice", level, message, audio, at: Date.now() });
}
