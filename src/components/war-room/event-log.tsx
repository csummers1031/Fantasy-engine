"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn, formatTime } from "@/lib/utils";
import type { EngineEvent } from "@/lib/types";

function describe(event: EngineEvent): { text: string; tone: string } {
  switch (event.type) {
    case "draft.pick":
      return { text: `#${event.overall} ${event.teamName} selected ${event.playerName}`, tone: "text-foreground" };
    case "run.alert":
      return { text: event.alert.message, tone: event.alert.severity === "critical" ? "text-desk-down" : "text-desk-warn" };
    case "runner.status":
      return { text: `Runner ${event.runner.status}${event.runner.lastError ? `: ${event.runner.lastError}` : ""}`, tone: event.runner.status === "error" || event.runner.status === "degraded" ? "text-desk-warn" : "text-muted-foreground" };
    case "runner.mode":
      return { text: `Mode -> ${event.mode} (${event.reason})`, tone: event.mode === "autopilot" ? "text-desk-warn" : "text-desk-info" };
    case "autopilot.action":
      return { text: `${event.success ? "Autopilot drafted" : "Autopilot failed for"} ${event.playerName}: ${event.detail}`, tone: event.success ? "text-desk-up" : "text-desk-down" };
    case "selector.failure":
      return { text: `Selector failure (${event.attempted.length} selectors tried): ${event.message}`, tone: "text-desk-down" };
    case "browser.session":
      return { text: `Browser ${event.status} for ${event.provider} on port ${event.port}`, tone: "text-desk-info" };
    case "sandbox.progress":
      return { text: `Sandbox ${event.completedPicks}/${event.totalPicks}`, tone: "text-muted-foreground" };
    case "sandbox.complete":
      return { text: `Sandbox complete in ${event.durationMs}ms (${event.picksPerSecond} picks/s)`, tone: "text-desk-up" };
    case "system.notice":
      return { text: event.message, tone: event.level === "critical" ? "text-desk-down" : event.level === "warning" ? "text-desk-warn" : "text-muted-foreground" };
    case "draft.snapshot":
      return { text: `Snapshot: pick ${event.snapshot.currentPickOverall}, ${event.snapshot.runAlerts.length} alerts`, tone: "text-muted-foreground" };
    case "heartbeat":
      return { text: "heartbeat", tone: "text-muted-foreground" };
  }
}

export function EventLog({ events }: { events: EngineEvent[] }) {
  const visible = events.filter((event) => event.type !== "draft.snapshot" && event.type !== "heartbeat").slice(-80).reverse();
  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle>Event log</CardTitle>
        <span className="mono text-[10px] text-muted-foreground">{visible.length}</span>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 p-0">
        <ScrollArea className="h-full max-h-[300px]">
          <div className="divide-y divide-desk-line/60 font-mono text-[10px]">
            {visible.length === 0 ? <div className="p-3 text-muted-foreground">Waiting for events.</div> : null}
            {visible.map((event, index) => {
              const { text, tone } = describe(event);
              return (
                <div key={`${event.at}-${index}`} className="flex gap-2 px-3 py-0.5">
                  <span className="shrink-0 text-muted-foreground">{formatTime(event.at)}</span>
                  <span className={cn("truncate", tone)} title={text}>
                    {text}
                  </span>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
