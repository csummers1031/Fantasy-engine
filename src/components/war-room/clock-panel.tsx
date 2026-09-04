"use client";

import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn, formatSeconds, ordinal } from "@/lib/utils";
import type { AnalysisSnapshot, LeagueRecord, RunnerPolicy } from "@/lib/types";

interface ClockPanelProps {
  league: LeagueRecord;
  snapshot: AnalysisSnapshot | null;
  policy: RunnerPolicy;
  userOnClock: boolean;
}

export function ClockPanel({ league, snapshot, policy, userOnClock }: ClockPanelProps) {
  const [remaining, setRemaining] = useState(snapshot ? snapshot.secondsRemaining : 0);

  useEffect(() => {
    if (!snapshot) {
      return;
    }
    const anchor = snapshot.generatedAt;
    const base = snapshot.secondsRemaining;
    const update = (): void => setRemaining(Math.max(0, base - (Date.now() - anchor) / 1000));
    update();
    const timer = setInterval(update, 250);
    return () => clearInterval(timer);
  }, [snapshot]);

  const total = league.settings.pickTimerSeconds;
  const percent = total > 0 ? Math.min(100, (remaining / total) * 100) : 0;
  const inBuffer = remaining <= policy.safeTimeBufferSeconds;
  const round = snapshot ? Math.ceil(snapshot.currentPickOverall / league.settings.teams) : 0;
  const pickInRound = snapshot ? ((snapshot.currentPickOverall - 1) % league.settings.teams) + 1 : 0;

  return (
    <Card className={cn("h-full", userOnClock && "border-desk-info/60", userOnClock && inBuffer && policy.mode === "autopilot" && "border-desk-warn animate-pulse-alert")}>
      <CardContent className="flex h-full flex-col justify-between gap-2 p-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Draft clock</div>
            <div className={cn("mono text-3xl font-bold tabular-nums leading-none", remaining <= 10 ? "text-desk-down" : remaining <= policy.safeTimeBufferSeconds ? "text-desk-warn" : "text-foreground")}>{formatSeconds(remaining)}</div>
          </div>
          <Timer className="h-4 w-4 text-muted-foreground" />
        </div>
        <Progress value={percent} indicatorClassName={remaining <= policy.safeTimeBufferSeconds ? "bg-desk-warn" : "bg-desk-info"} />
        <div className="grid grid-cols-3 gap-1 text-[11px]">
          <div>
            <div className="text-muted-foreground">Pick</div>
            <div className="mono font-semibold">
              {snapshot ? `${round}.${pickInRound.toString().padStart(2, "0")}` : "--"} <span className="text-muted-foreground">#{snapshot ? snapshot.currentPickOverall : "--"}</span>
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">On clock</div>
            <div className="truncate font-semibold">{snapshot ? snapshot.onClockTeamName || "unknown" : "--"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Your turn</div>
            <div className="mono font-semibold">{snapshot ? (snapshot.picksUntilUserTurn === 0 ? "NOW" : snapshot.picksUntilUserTurn < 0 ? "done" : `in ${snapshot.picksUntilUserTurn} (${ordinal(snapshot.userNextPickOverall)})`) : "--"}</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {userOnClock ? <Badge variant="info">you are on the clock</Badge> : <Badge variant="outline">waiting</Badge>}
          {policy.mode === "autopilot" ? <Badge variant={inBuffer && userOnClock ? "critical" : "warning"}>autopilot fires at {policy.safeTimeBufferSeconds}s</Badge> : <Badge variant="outline">co-pilot</Badge>}
        </div>
      </CardContent>
    </Card>
  );
}
