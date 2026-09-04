"use client";

import { useState } from "react";
import Link from "next/link";
import { Activity, FlaskConical, Gauge, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useEventStream } from "@/hooks/use-event-stream";
import { apiRequest } from "@/hooks/use-api";
import type { StressTestResult } from "@/lib/sandbox/simulator";
import type { LeagueRecord, RunnerRecord } from "@/lib/types";

interface LiveSandboxResponse {
  sandboxId: string;
  league: LeagueRecord;
  runner: RunnerRecord | null;
}

interface SandboxConsoleProps {
  liveSandboxes: Array<{ id: string; leagueId: string; name: string; picks: number; totalPicks: number; complete: boolean }>;
  history: Array<{ id: string; label: string; picksPerSecond: number; durationMs: number; errors: number; createdAt: number }>;
}

export function SandboxConsole({ liveSandboxes, history }: SandboxConsoleProps) {
  const [teams, setTeams] = useState(12);
  const [rounds, setRounds] = useState(15);
  const [userSlot, setUserSlot] = useState(5);
  const [simulations, setSimulations] = useState(10);
  const [pickTimer, setPickTimer] = useState(45);
  const [buffer, setBuffer] = useState(12);
  const [result, setResult] = useState<(StressTestResult & { simulationId: string }) | null>(null);
  const [live, setLive] = useState<LiveSandboxResponse | null>(null);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  useEventStream((event) => {
    if (event.type === "sandbox.progress") {
      setProgress(Math.round((event.completedPicks / Math.max(1, event.totalPicks)) * 100));
    }
  });

  const runStress = async (): Promise<void> => {
    setPending(true);
    setMessage("");
    setProgress(0);
    try {
      const response = await apiRequest<StressTestResult & { simulationId: string }>("/api/sandbox/simulate", {
        method: "POST",
        body: JSON.stringify({ simulations, config: { teams, rounds, userSlot: Math.min(userSlot, teams), pickTimerSeconds: pickTimer, botDelayMinMs: 100, botDelayMaxMs: 200, seed: Date.now() % 100000 }, policy: { safeTimeBufferSeconds: buffer } }),
      });
      setResult(response);
      setProgress(100);
      setMessage(`${response.totalPicks} picks in ${response.durationMs}ms with ${response.errors} errors.`);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setPending(false);
    }
  };

  const startLive = async (): Promise<void> => {
    setPending(true);
    setMessage("");
    try {
      const response = await apiRequest<LiveSandboxResponse>("/api/sandbox/live", {
        method: "POST",
        body: JSON.stringify({ config: { teams, rounds, userSlot: Math.min(userSlot, teams), pickTimerSeconds: pickTimer, botDelayMinMs: 1200, botDelayMaxMs: 4000, seed: Date.now() % 100000 }, policy: { mode: "copilot", safeTimeBufferSeconds: buffer, pollIntervalMs: 1000 }, autoStartRunner: true }),
      });
      setLive(response);
      setMessage(`Live sandbox ${response.sandboxId} running with a co-pilot runner. Open the war room and flip to autopilot to watch it draft for you.`);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setPending(false);
    }
  };

  const destroy = async (id: string): Promise<void> => {
    setPending(true);
    try {
      await apiRequest(`/api/sandbox/live/${id}`, { method: "DELETE" });
      setMessage(`Sandbox ${id} destroyed.`);
      window.location.reload();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="desk-grid grid-cols-1 xl:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>Simulation matrix</CardTitle>
          <FlaskConical className="h-3.5 w-3.5 text-muted-foreground" />
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label>Teams</Label>
              <Input type="number" min={4} max={16} value={teams} onChange={(event) => setTeams(Number(event.target.value))} />
            </div>
            <div className="space-y-1">
              <Label>Rounds</Label>
              <Input type="number" min={4} max={20} value={rounds} onChange={(event) => setRounds(Number(event.target.value))} />
            </div>
            <div className="space-y-1">
              <Label>Your slot</Label>
              <Input type="number" min={1} max={16} value={userSlot} onChange={(event) => setUserSlot(Number(event.target.value))} />
            </div>
            <div className="space-y-1">
              <Label>Pick timer (s)</Label>
              <Input type="number" min={5} max={600} value={pickTimer} onChange={(event) => setPickTimer(Number(event.target.value))} />
            </div>
            <div className="space-y-1">
              <Label>Safe buffer (s)</Label>
              <Input type="number" min={1} max={600} value={buffer} onChange={(event) => setBuffer(Number(event.target.value))} />
            </div>
            <div className="space-y-1">
              <Label>Stress runs</Label>
              <Input type="number" min={1} max={200} value={simulations} onChange={(event) => setSimulations(Number(event.target.value))} />
            </div>
          </div>
          <div className="flex flex-wrap gap-1">
            <Button size="sm" onClick={() => void runStress()} disabled={pending}>
              <Gauge /> Fire stress test
            </Button>
            <Button asChild size="sm" variant="success">
              <Link href="/sandbox/live">
                <Activity /> Start live sandbox
              </Link>
            </Button>
            <Button size="sm" variant="outline" onClick={() => void startLive()} disabled={pending} title="Runs the draft as a server process. Local runtime only; serverless hosts drop it between requests.">
              Server sandbox
            </Button>
          </div>
          {pending || progress > 0 ? <Progress value={progress} /> : null}
          {message !== "" ? <div className="text-[11px] text-muted-foreground">{message}</div> : null}
          {live ? (
            <Button asChild size="sm" variant="outline">
              <Link href={`/war-room/${live.league.id}`}>Open war room for {live.league.name}</Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Stress result</CardTitle>
          {result ? <Badge variant={result.errors === 0 ? "success" : "warning"}>{result.errors === 0 ? "stable" : `${result.errors} errors`}</Badge> : null}
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          {!result ? <div className="text-muted-foreground">Run a stress test to measure autopilot decision latency under rapid bot drafting.</div> : null}
          {result ? (
            <>
              <div className="grid grid-cols-2 gap-1">
                <div>
                  <div className="text-[10px] text-muted-foreground">Picks / second</div>
                  <div className="mono text-lg font-bold">{result.picksPerSecond}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">Total picks</div>
                  <div className="mono text-lg font-bold">{result.totalPicks}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">Decision p50 / p95 / max</div>
                  <div className="mono">
                    {result.analysisLatencyMs.p50} / {result.analysisLatencyMs.p95} / {result.analysisLatencyMs.max} ms
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">Duration</div>
                  <div className="mono">{result.durationMs} ms</div>
                </div>
              </div>
              <div className="max-h-56 overflow-auto rounded border border-desk-line">
                {result.userRosters.slice(0, 5).map((entry) => (
                  <div key={entry.simulation} className="border-b border-desk-line/60 px-2 py-1">
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>Sim {entry.simulation}</span>
                      <span className="mono">VBD {entry.totalVbd}</span>
                    </div>
                    <div className="text-[10px]">{entry.roster.map((player) => `R${player.round} ${player.name} (${player.position})`).join(" · ")}</div>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
      <div className="flex flex-col gap-2">
        <Card>
          <CardHeader>
            <CardTitle>Live sandboxes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-xs">
            {liveSandboxes.length === 0 ? <div className="text-muted-foreground">No live sandbox running in this process.</div> : null}
            {liveSandboxes.map((sandbox) => (
              <div key={sandbox.id} className="flex items-center gap-2">
                <span className="truncate">{sandbox.name}</span>
                <span className="mono text-muted-foreground">
                  {sandbox.picks}/{sandbox.totalPicks}
                </span>
                <Badge variant={sandbox.complete ? "outline" : "success"}>{sandbox.complete ? "done" : "live"}</Badge>
                <Button asChild size="sm" variant="ghost" className="ml-auto">
                  <Link href={`/war-room/${sandbox.leagueId}`}>open</Link>
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6" disabled={pending} onClick={() => void destroy(sandbox.id)}>
                  <Trash2 />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent stress runs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-[11px]">
            {history.length === 0 ? <div className="text-muted-foreground">No history.</div> : null}
            {history.map((entry) => (
              <div key={entry.id} className="flex items-center gap-2">
                <span className="truncate">{entry.label}</span>
                <span className="mono ml-auto text-muted-foreground">{entry.picksPerSecond} p/s</span>
                <Badge variant={entry.errors === 0 ? "success" : "warning"}>{entry.errors}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
