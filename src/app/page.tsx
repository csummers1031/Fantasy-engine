import Link from "next/link";
import { ArrowRight, Radio, Shield, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listLeagues } from "@/lib/leagues/service";
import { listRunners } from "@/lib/automation/manager";
import { automationCapability } from "@/lib/automation/runtime";
import { listCredentialSummaries } from "@/lib/db/credentials";
import { formatTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PROVIDER_ICONS = { sleeper: Radio, espn: Shield, yahoo: Sparkles } as const;

export default async function OverviewPage() {
  const [leagues, runners, credentials] = await Promise.all([listLeagues(), listRunners(), listCredentialSummaries()]);
  const capability = automationCapability();
  const activeRunners = runners.filter((runner) => runner.live);
  return (
    <div className="desk-grid grid-cols-1 gap-3 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Leagues</CardTitle>
          <div className="flex gap-1">
            <Button asChild size="sm" variant="outline">
              <Link href="/leagues/sleeper">Add Sleeper</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/leagues/espn">Add ESPN</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/leagues/yahoo">Add Yahoo</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {leagues.length === 0 ? (
            <div className="p-4 text-xs text-muted-foreground">No leagues yet. Add a league from a provider tab or launch a live sandbox to exercise the war room.</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="border-b border-desk-line text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-1.5 text-left">League</th>
                  <th className="px-3 py-1.5 text-left">Provider</th>
                  <th className="px-3 py-1.5 text-left">Format</th>
                  <th className="px-3 py-1.5 text-left">Last sync</th>
                  <th className="px-3 py-1.5 text-left">Runner</th>
                  <th className="px-3 py-1.5" />
                </tr>
              </thead>
              <tbody>
                {leagues.map((league) => {
                  const Icon = PROVIDER_ICONS[league.provider];
                  const runner = activeRunners.find((candidate) => candidate.leagueId === league.id);
                  return (
                    <tr key={league.id} className="border-b border-desk-line/60">
                      <td className="px-3 py-1.5 font-medium">{league.name}</td>
                      <td className="px-3 py-1.5">
                        <span className="inline-flex items-center gap-1 capitalize">
                          <Icon className="h-3 w-3" />
                          {league.provider}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-muted-foreground">
                        {league.settings.teams} teams, {league.settings.rounds} rounds, {league.settings.scoring.reception} PPR
                      </td>
                      <td className="px-3 py-1.5 text-muted-foreground">{league.lastSyncError !== "" ? <span className="text-desk-warn">{league.lastSyncError}</span> : formatTime(league.lastSyncAt) || "never"}</td>
                      <td className="px-3 py-1.5">{runner ? <Badge variant={runner.policy.mode === "autopilot" ? "warning" : "info"}>{runner.policy.mode}</Badge> : <Badge variant="outline">idle</Badge>}</td>
                      <td className="px-3 py-1.5 text-right">
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/war-room/${league.id}`}>
                            War room <ArrowRight className="h-3 w-3" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
      <div className="flex flex-col gap-3">
        <Card>
          <CardHeader>
            <CardTitle>Runtime</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Browser automation</span>
              <Badge variant={capability.supported ? "success" : "warning"}>{capability.supported ? "available" : "unavailable"}</Badge>
            </div>
            {!capability.supported ? <div className="text-[11px] text-muted-foreground">{capability.reason}</div> : <div className="truncate text-[11px] text-muted-foreground">{capability.executablePath}</div>}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Active runners</span>
              <span className="mono">{activeRunners.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Stored credentials</span>
              <span className="mono">{credentials.length}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Quick start</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-xs text-muted-foreground">
            <div>1. Save provider credentials on the provider tab (Sleeper username, ESPN cookies, Yahoo consumer key).</div>
            <div>2. Add the league by ID. Roster slots, scoring, and draft ID are pulled automatically.</div>
            <div>3. Open the war room, start the co-pilot runner, and flip to autopilot once a browser session is attached.</div>
            <div>4. Use the sandbox to stress test the engine offline before draft day.</div>
            <Button asChild size="sm" className="mt-1">
              <Link href="/sandbox">Open sandbox</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
