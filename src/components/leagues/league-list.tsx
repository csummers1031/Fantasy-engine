"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, RefreshCw, Trash2 } from "lucide-react";
import { deleteLeagueAction, syncLeagueAction } from "@/app/actions/leagues";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatTime } from "@/lib/utils";
import type { LeagueRecord } from "@/lib/types";

export function LeagueList({ leagues }: { leagues: LeagueRecord[] }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const router = useRouter();
  const run = (operation: () => Promise<{ ok: boolean; message: string }>): void => {
    startTransition(async () => {
      const result = await operation();
      setMessage(result.message);
      router.refresh();
    });
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Configured leagues</CardTitle>
        {message !== "" ? <span className="text-[11px] text-muted-foreground">{message}</span> : null}
      </CardHeader>
      <CardContent className="p-0">
        {leagues.length === 0 ? <div className="p-3 text-xs text-muted-foreground">None yet.</div> : null}
        <div className="divide-y divide-desk-line/60">
          {leagues.map((league) => (
            <div key={league.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-xs">
              <div className="w-full min-w-0 lg:w-auto lg:flex-1">
                <div className="font-medium">{league.name}</div>
                <div className="break-words text-[10px] text-muted-foreground">
                  id {league.externalLeagueId} · draft {league.draftId || "n/a"} · team {league.userTeamId || "unresolved"} · {league.settings.teams} teams · {league.settings.rosterPositions.join(" ")}
                </div>
              </div>
              {league.lastSyncError !== "" ? <Badge variant="warning" title={league.lastSyncError}>sync error</Badge> : <Badge variant="success">synced {formatTime(league.lastSyncAt)}</Badge>}
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => syncLeagueAction(league.id, league.provider))}>
                <RefreshCw /> Sync
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href={`/war-room/${league.id}`}>
                  <Activity /> War room
                </Link>
              </Button>
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => deleteLeagueAction(league.id, league.provider))}>
                <Trash2 />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
