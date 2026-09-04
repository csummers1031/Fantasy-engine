"use client";

import { useMemo, useState } from "react";
import { Plus, Ban, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PositionBadge } from "./position-badge";
import { cn, formatDelta } from "@/lib/utils";
import { POSITIONS } from "@/lib/types";
import type { Position, ValuedPlayer } from "@/lib/types";

interface AvailableTableProps {
  available: ValuedPlayer[];
  queue: string[];
  avoid: string[];
  canPick: boolean;
  onQueue: (playerId: string) => void;
  onAvoid: (playerId: string) => void;
  onPick: (playerId: string) => void;
}

export function AvailableTable({ available, queue, avoid, canPick, onQueue, onAvoid, onPick }: AvailableTableProps) {
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState<Position | "ALL">("ALL");
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return available.filter((player) => (position === "ALL" || player.position === position) && (term === "" || player.name.toLowerCase().includes(term) || player.team.toLowerCase().includes(term))).slice(0, 80);
  }, [available, search, position]);
  const queuedPlayers = queue.map((id) => available.find((player) => player.id === id)).filter((player): player is ValuedPlayer => player !== undefined);
  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="gap-2">
        <CardTitle>Available</CardTitle>
        <div className="flex flex-1 items-center gap-1">
          <Input placeholder="Search player or team" value={search} onChange={(event) => setSearch(event.target.value)} className="h-7 max-w-[180px]" />
          <div className="flex gap-0.5">
            {(["ALL", ...POSITIONS] as const).map((option) => (
              <Button key={option} size="sm" variant={position === option ? "default" : "ghost"} className="h-6 px-1.5 text-[10px]" onClick={() => setPosition(option)}>
                {option}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 p-0">
        {queuedPlayers.length > 0 ? (
          <div className="flex flex-wrap gap-1 border-b border-desk-line px-3 py-1.5 text-[10px]">
            <span className="text-muted-foreground">Queue:</span>
            {queuedPlayers.map((player, index) => (
              <button key={player.id} className="rounded border border-desk-info/40 bg-desk-info/10 px-1.5 py-0.5 hover:bg-desk-info/20" onClick={() => onQueue(player.id)} title="Remove from queue">
                {index + 1}. {player.name}
              </button>
            ))}
          </div>
        ) : null}
        <ScrollArea className="h-full max-h-[360px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">Rk</TableHead>
                <TableHead>Player</TableHead>
                <TableHead className="w-10">Pos</TableHead>
                <TableHead className="w-12 text-right">Proj</TableHead>
                <TableHead className="w-12 text-right">VBD</TableHead>
                <TableHead className="w-10 text-right">Tier</TableHead>
                <TableHead className="w-12 text-right">ADP</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((player) => {
                const queued = queue.includes(player.id);
                const avoided = avoid.includes(player.id);
                return (
                  <TableRow key={player.id} className={cn(avoided && "opacity-50")}>
                    <TableCell className="mono text-muted-foreground">{player.overallRank}</TableCell>
                    <TableCell>
                      <div className="font-medium">{player.name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {player.team} · {player.position}
                        {player.positionalRank}
                      </div>
                    </TableCell>
                    <TableCell>
                      <PositionBadge position={player.position} />
                    </TableCell>
                    <TableCell className="mono text-right">{player.projectedPoints.toFixed(0)}</TableCell>
                    <TableCell className={cn("mono text-right", player.vbd >= 0 ? "text-desk-up" : "text-desk-down")}>{formatDelta(player.vbd)}</TableCell>
                    <TableCell className="mono text-right">{player.tier}</TableCell>
                    <TableCell className="mono text-right">{player.adp.toFixed(0)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-0.5">
                        <Button size="icon" variant={queued ? "default" : "ghost"} className="h-6 w-6" onClick={() => onQueue(player.id)}>
                          <Plus />
                        </Button>
                        <Button size="icon" variant={avoided ? "destructive" : "ghost"} className="h-6 w-6" onClick={() => onAvoid(player.id)}>
                          <Ban />
                        </Button>
                        {canPick ? (
                          <Button size="icon" variant="success" className="h-6 w-6" onClick={() => onPick(player.id)}>
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
