"use client";

import { Plus, Ban, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PositionBadge } from "./position-badge";
import { cn, formatDelta } from "@/lib/utils";
import type { Recommendation } from "@/lib/types";

interface RecommendationsTableProps {
  recommendations: Recommendation[];
  queue: string[];
  avoid: string[];
  canPick: boolean;
  onQueue: (playerId: string) => void;
  onAvoid: (playerId: string) => void;
  onPick: (playerId: string) => void;
}

export function RecommendationsTable({ recommendations, queue, avoid, canPick, onQueue, onAvoid, onPick }: RecommendationsTableProps) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle>Recommendations</CardTitle>
        <span className="text-[10px] text-muted-foreground">VBD + need + scarcity + run pressure</span>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 p-0">
        <ScrollArea className="h-full max-h-[420px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-6">#</TableHead>
                <TableHead>Player</TableHead>
                <TableHead className="w-10">Pos</TableHead>
                <TableHead className="w-12 text-right">Score</TableHead>
                <TableHead className="w-12 text-right">VBD</TableHead>
                <TableHead className="w-10 text-right">Tier</TableHead>
                <TableHead className="w-12 text-right">ADP</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {recommendations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-6 text-center text-muted-foreground">
                    No analysis yet. Start the runner or sync the league.
                  </TableCell>
                </TableRow>
              ) : null}
              {recommendations.map((recommendation, index) => {
                const player = recommendation.player;
                const queued = queue.includes(player.id);
                const avoided = avoid.includes(player.id);
                return (
                  <TableRow key={player.id} className={cn(index === 0 && "bg-desk-info/10", avoided && "opacity-50")}>
                    <TableCell className="mono text-muted-foreground">{index + 1}</TableCell>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="cursor-help">
                            <div className="font-medium">{player.name}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {player.team} · bye {player.byeWeek} · {player.injuryStatus !== "healthy" ? <span className="text-desk-warn">{player.injuryStatus}</span> : "healthy"}
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <ul className="list-disc pl-3">
                            {recommendation.reasons.map((reason) => (
                              <li key={reason}>{reason}</li>
                            ))}
                          </ul>
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <PositionBadge position={player.position} />
                    </TableCell>
                    <TableCell className="mono text-right font-semibold">{recommendation.score.toFixed(1)}</TableCell>
                    <TableCell className={cn("mono text-right", player.vbd >= 0 ? "text-desk-up" : "text-desk-down")}>{formatDelta(player.vbd)}</TableCell>
                    <TableCell className="mono text-right">{player.tier}</TableCell>
                    <TableCell className={cn("mono text-right", player.adpDelta > 5 ? "text-desk-up" : player.adpDelta < -5 ? "text-desk-down" : "")}>{player.adp.toFixed(0)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-0.5">
                        <Button size="icon" variant={queued ? "default" : "ghost"} className="h-6 w-6" onClick={() => onQueue(player.id)} title={queued ? "Remove from queue" : "Add to queue"}>
                          <Plus />
                        </Button>
                        <Button size="icon" variant={avoided ? "destructive" : "ghost"} className="h-6 w-6" onClick={() => onAvoid(player.id)} title={avoided ? "Unblock" : "Never draft"}>
                          <Ban />
                        </Button>
                        {canPick ? (
                          <Button size="icon" variant="success" className="h-6 w-6" onClick={() => onPick(player.id)} title="Draft now">
                            <Zap />
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
