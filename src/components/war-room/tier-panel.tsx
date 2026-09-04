"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { PositionBadge } from "./position-badge";
import { cn } from "@/lib/utils";
import { POSITIONS } from "@/lib/types";
import type { TierSummary } from "@/lib/types";

export function TierPanel({ tiers, picksUntilUserTurn }: { tiers: TierSummary[]; picksUntilUserTurn: number }) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle>Tier falloff</CardTitle>
        <span className="text-[10px] text-muted-foreground">survival over next {Math.max(0, picksUntilUserTurn)} picks</span>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 p-0">
        <ScrollArea className="h-full max-h-[420px]">
          <div className="divide-y divide-desk-line/60">
            {POSITIONS.map((position) => {
              const group = tiers.filter((tier) => tier.position === position).slice(0, 3);
              if (group.length === 0) {
                return null;
              }
              return (
                <div key={position} className="px-3 py-2">
                  <div className="mb-1 flex items-center gap-2">
                    <PositionBadge position={position} />
                    <span className="text-[10px] text-muted-foreground">{group.reduce((sum, tier) => sum + tier.remaining.length, 0)} across top tiers</span>
                  </div>
                  <div className="space-y-1.5">
                    {group.map((tier) => {
                      const survival = Math.round(tier.survivalProbability * 100);
                      return (
                        <div key={`${tier.position}-${tier.tier}`} className="text-[11px]">
                          <div className="flex items-center justify-between">
                            <span>
                              Tier {tier.tier} <span className="text-muted-foreground">({tier.remaining.length} left)</span>
                            </span>
                            <span className={cn("mono", survival < 40 ? "text-desk-down" : survival < 70 ? "text-desk-warn" : "text-desk-up")}>
                              {survival}% · cliff {tier.falloffToNextTier.toFixed(0)}
                            </span>
                          </div>
                          <Progress value={survival} indicatorClassName={survival < 40 ? "bg-desk-down" : survival < 70 ? "bg-desk-warn" : "bg-desk-up"} className="mt-0.5" />
                          <div className="mt-0.5 truncate text-[10px] text-muted-foreground">{tier.remaining.map((player) => player.name).join(", ")}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
