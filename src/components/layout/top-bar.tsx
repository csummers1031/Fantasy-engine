"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, Wifi, WifiOff } from "lucide-react";
import { useEventStream } from "@/hooks/use-event-stream";
import { useAudioAlert } from "@/hooks/use-audio-alert";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { EngineEvent } from "@/lib/types";

interface Toast {
  id: number;
  level: "info" | "warning" | "critical";
  message: string;
}

export function TopBar() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const playTone = useAudioAlert(audioEnabled);
  const mountedAt = useRef(Date.now());
  const seenKeys = useRef(new Set<string>());

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings", { cache: "no-store" })
      .then((response) => response.json())
      .then((envelope: { ok: boolean; data?: { audioAlerts: boolean } }) => {
        if (!cancelled && envelope.ok && envelope.data) {
          setAudioEnabled(envelope.data.audioAlerts);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const { connected } = useEventStream((event: EngineEvent) => {
    if (event.at < mountedAt.current - 2000) {
      return;
    }
    if (event.type === "system.notice") {
      pushToast(event.level, event.message, event.audio, `${event.type}:${event.at}`);
    } else if (event.type === "selector.failure") {
      pushToast("critical", `Selector failure on ${event.provider}: ${event.message}`, true, `${event.type}:${event.runnerId}:${event.at}`);
    } else if (event.type === "run.alert" && event.alert.severity === "critical") {
      pushToast("warning", event.alert.message, false, `run:${event.leagueId}:${event.alert.position}:${event.alert.tier}`);
    }
  });

  const pushToast = (level: Toast["level"], message: string, audio: boolean, key: string): void => {
    if (seenKeys.current.has(key)) {
      return;
    }
    seenKeys.current.add(key);
    if (seenKeys.current.size > 200) {
      seenKeys.current.clear();
    }
    const id = Date.now() + Math.random();
    setToasts((previous) => [...previous.slice(-2), { id, level, message }]);
    if (audio) {
      playTone(level);
    }
    setTimeout(() => setToasts((previous) => previous.filter((toast) => toast.id !== id)), level === "critical" ? 12000 : 6000);
  };

  return (
    <header className="flex h-10 items-center justify-between border-b border-desk-line bg-desk-panel px-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">Live desk</span>
        <span className="hidden sm:inline">Co-pilot analytics and autopilot execution across Sleeper, ESPN, and Yahoo</span>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={connected ? "success" : "warning"} className="gap-1">
          {connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
          {connected ? "stream live" : "reconnecting"}
        </Badge>
        <Bell className={cn("h-3.5 w-3.5", audioEnabled ? "text-desk-info" : "text-muted-foreground")} />
      </div>
      <div className="pointer-events-none fixed right-3 top-12 z-50 flex w-80 flex-col gap-2">
        {toasts.map((toast) => (
          <div key={toast.id} className={cn("pointer-events-auto rounded-md border px-3 py-2 text-xs shadow-lg", toast.level === "critical" && "border-desk-down/60 bg-desk-down/20 text-red-100 animate-pulse-alert", toast.level === "warning" && "border-desk-warn/60 bg-desk-warn/15 text-amber-100", toast.level === "info" && "border-desk-info/60 bg-desk-info/15 text-sky-100")}>
            {toast.message}
          </div>
        ))}
      </div>
    </header>
  );
}
