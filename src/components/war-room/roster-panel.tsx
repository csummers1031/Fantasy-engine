"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PositionBadge } from "./position-badge";
import { formatDelta } from "@/lib/utils";
import type { RosterNeed, ValuedPlayer } from "@/lib/types";

export function RosterPanel({ roster, needs }: { roster: ValuedPlayer[]; needs: RosterNeed[] }) {
  const totalVbd = roster.reduce((sum, player) => sum + player.vbd, 0);
  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle>Your roster</CardTitle>
        <span className="mono text-[10px] text-muted-foreground">
          {roster.length} picks · VBD {formatDelta(totalVbd)}
        </span>
      </CardHeader>
      <CardContent className="space-y-2 p-3">
        <div className="grid grid-cols-6 gap-1">
          {needs.map((need) => (
            <div key={need.position} className="text-center">
              <PositionBadge position={need.position} className="w-full" />
              <div className="mono mt-0.5 text-[10px]">
                {need.startersFilled}/{need.startersRequired}
                {need.benchDepth > 0 ? <span className="text-muted-foreground">+{need.benchDepth}</span> : null}
              </div>
              <Progress value={Math.round(need.need * 100)} indicatorClassName={need.need > 0.6 ? "bg-desk-down" : need.need > 0.3 ? "bg-desk-warn" : "bg-desk-up"} className="mt-0.5 h-1" />
            </div>
          ))}
        </div>
        <div className="max-h-48 space-y-0.5 overflow-auto text-[11px]">
          {roster.length === 0 ? <div className="text-muted-foreground">No picks yet.</div> : null}
          {roster.map((player) => (
            <div key={player.id} className="flex items-center gap-1.5">
              <PositionBadge position={player.position} />
              <span className="truncate">{player.name}</span>
              <span className="mono ml-auto text-muted-foreground">{formatDelta(player.vbd)}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
