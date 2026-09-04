"use client";

import { Siren } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PositionBadge } from "./position-badge";
import { cn } from "@/lib/utils";
import type { OpponentNeed, RunAlert } from "@/lib/types";

export function RunAlertsPanel({ alerts, opponents }: { alerts: RunAlert[]; opponents: OpponentNeed[] }) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle>Run and snipe radar</CardTitle>
        <Siren className={cn("h-3.5 w-3.5", alerts.some((alert) => alert.severity === "critical") ? "text-desk-down animate-pulse" : "text-muted-foreground")} />
      </CardHeader>
      <CardContent className="space-y-2 p-3">
        {alerts.length === 0 ? <div className="text-[11px] text-muted-foreground">No positional runs projected before your next pick.</div> : null}
        {alerts.map((alert) => (
          <div key={alert.id} className={cn("rounded-md border p-2 text-[11px]", alert.severity === "critical" ? "border-desk-down/60 bg-desk-down/15 animate-pulse-alert" : "border-desk-warn/50 bg-desk-warn/10")}>
            <div className="mb-1 flex items-center gap-1.5">
              <PositionBadge position={alert.position} />
              <Badge variant={alert.severity === "critical" ? "critical" : "warning"}>{alert.severity}</Badge>
              <span className="mono ml-auto text-muted-foreground">
                {alert.opponentsHungry} hungry · {alert.premiumRemaining} left
              </span>
            </div>
            <div>{alert.message}</div>
            <div className="mt-1 text-[10px] text-muted-foreground">At risk: {alert.playersAtRisk.join(", ")}</div>
          </div>
        ))}
        <div className="border-t border-desk-line pt-2">
          <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Opponents before your turn</div>
          {opponents.length === 0 ? <div className="text-[11px] text-muted-foreground">You are on the clock or the draft is complete.</div> : null}
          <div className="space-y-0.5">
            {opponents.map((opponent) => (
              <div key={opponent.teamId} className="flex items-center gap-1 text-[11px]">
                <span className="mono w-5 text-muted-foreground">{opponent.slot}</span>
                <span className="w-28 truncate">{opponent.teamName}</span>
                <span className="mono text-muted-foreground">x{opponent.picksBeforeUser}</span>
                <span className="ml-auto flex gap-0.5">
                  {opponent.likelyTargets.map((position) => (
                    <Badge key={position} variant={opponent.deficits.includes(position) ? "warning" : "outline"} className="px-1">
                      {position}
                    </Badge>
                  ))}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
