"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PositionBadge } from "./position-badge";
import { cn } from "@/lib/utils";
import type { DraftPick, DraftTeam } from "@/lib/types";

export function DraftBoard({ picks, teams, userTeamId, teamsCount }: { picks: DraftPick[]; teams: DraftTeam[]; userTeamId: string; teamsCount: number }) {
  const teamById = new Map(teams.map((team) => [team.id, team] as const));
  const recent = [...picks].sort((a, b) => b.overall - a.overall).slice(0, 60);
  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle>Draft board</CardTitle>
        <span className="mono text-[10px] text-muted-foreground">{picks.length} picks</span>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 p-0">
        <ScrollArea className="h-full max-h-[300px]">
          <div className="divide-y divide-desk-line/60">
            {recent.length === 0 ? <div className="p-3 text-[11px] text-muted-foreground">No picks recorded.</div> : null}
            {recent.map((pick) => {
              const team = teamById.get(pick.teamId);
              const isUser = pick.teamId === userTeamId;
              const round = Math.ceil(pick.overall / teamsCount);
              const inRound = ((pick.overall - 1) % teamsCount) + 1;
              return (
                <div key={pick.overall} className={cn("flex items-center gap-1.5 px-3 py-1 text-[11px]", isUser && "bg-desk-info/10")}>
                  <span className="mono w-10 text-muted-foreground">
                    {round}.{inRound.toString().padStart(2, "0")}
                  </span>
                  <PositionBadge position={pick.position} />
                  <span className="truncate font-medium">{pick.playerName}</span>
                  <span className="ml-auto truncate text-muted-foreground">{team ? team.name : pick.teamId}</span>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
