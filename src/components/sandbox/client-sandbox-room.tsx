"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Play, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PanelErrorBoundary } from "@/components/error-boundary";
import { useAudioAlert } from "@/hooks/use-audio-alert";
import { useClientSandbox, type ClientSandboxConfig } from "@/hooks/use-client-sandbox";
import { ClockPanel } from "@/components/war-room/clock-panel";
import { ControlPanel } from "@/components/war-room/control-panel";
import { RecommendationsTable } from "@/components/war-room/recommendations-table";
import { TierPanel } from "@/components/war-room/tier-panel";
import { RunAlertsPanel } from "@/components/war-room/run-alerts-panel";
import { RosterPanel } from "@/components/war-room/roster-panel";
import { DraftBoard } from "@/components/war-room/draft-board";
import { EventLog } from "@/components/war-room/event-log";
import { AvailableTable } from "@/components/war-room/available-table";
import { useEffect, useRef } from "react";

const NO_AUTOMATION = { supported: true, reason: "", executablePath: "browser" };

export function ClientSandboxRoom() {
  const sandbox = useClientSandbox();
  const [teams, setTeams] = useState(12);
  const [rounds, setRounds] = useState(16);
  const [userSlot, setUserSlot] = useState(5);
  const [pickTimer, setPickTimer] = useState(60);
  const [buffer, setBuffer] = useState(15);
  const [mode, setMode] = useState<"copilot" | "autopilot">("autopilot");
  const [message, setMessage] = useState("");
  const playTone = useAudioAlert(true);
  const lastEventCount = useRef(0);

  useEffect(() => {
    const fresh = sandbox.events.slice(lastEventCount.current);
    lastEventCount.current = sandbox.events.length;
    for (const event of fresh) {
      if (event.type === "autopilot.action") {
        playTone("info");
      } else if (event.type === "run.alert" && event.alert.severity === "critical") {
        playTone("warning");
      } else if (event.type === "system.notice" && event.audio) {
        playTone(event.level);
      }
    }
  }, [sandbox.events, playTone]);

  const launch = (): void => {
    const config: ClientSandboxConfig = {
      teams,
      rounds,
      userSlot: Math.min(userSlot, teams),
      pickTimerSeconds: pickTimer,
      botDelayMinMs: 1200,
      botDelayMaxMs: 4500,
      seed: Math.floor(Math.random() * 1_000_000),
    };
    sandbox.start(config, { mode, safeTimeBufferSeconds: buffer });
    setMessage("");
  };

  if (!sandbox.ready) {
    return <div className="p-4 text-xs text-muted-foreground">Loading sandbox…</div>;
  }

  if (!sandbox.league || !sandbox.runner) {
    return (
      <div className="mx-auto max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle>Live sandbox draft</CardTitle>
            <Badge variant="info">runs in your browser</Badge>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <p className="text-muted-foreground">Eleven bots draft against you on a real clock. Flip autopilot on and the engine drafts for you when the buffer runs out, or stay in co-pilot and tap the lightning bolt on a player to draft by hand. Nothing here touches a real league.</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div className="space-y-1">
                <Label>Teams</Label>
                <Input type="number" min={4} max={16} value={teams} onChange={(event) => setTeams(Number(event.target.value))} />
              </div>
              <div className="space-y-1">
                <Label>Rounds</Label>
                <Input type="number" min={2} max={20} value={rounds} onChange={(event) => setRounds(Number(event.target.value))} />
              </div>
              <div className="space-y-1">
                <Label>Your slot</Label>
                <Input type="number" min={1} max={16} value={userSlot} onChange={(event) => setUserSlot(Number(event.target.value))} />
              </div>
              <div className="space-y-1">
                <Label>Pick clock (s)</Label>
                <Input type="number" min={10} max={600} value={pickTimer} onChange={(event) => setPickTimer(Number(event.target.value))} />
              </div>
              <div className="space-y-1">
                <Label>Autopilot buffer (s)</Label>
                <Input type="number" min={1} max={600} value={buffer} onChange={(event) => setBuffer(Number(event.target.value))} />
              </div>
              <div className="space-y-1">
                <Label>Start mode</Label>
                <div className="flex gap-1">
                  <Button type="button" size="sm" variant={mode === "copilot" ? "default" : "outline"} onClick={() => setMode("copilot")}>
                    Co-pilot
                  </Button>
                  <Button type="button" size="sm" variant={mode === "autopilot" ? "warning" : "outline"} onClick={() => setMode("autopilot")}>
                    Autopilot
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="success" onClick={launch}>
                <Play /> Start draft
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link href="/sandbox">
                  <ArrowLeft /> Back
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { league, snapshot, state, runner, policy } = sandbox;
  const picks = state ? state.picks : [];
  const teamsList = state ? state.teams : [];
  const complete = state ? state.status === "complete" : false;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild size="sm" variant="ghost">
          <Link href="/sandbox">
            <ArrowLeft /> sandbox
          </Link>
        </Button>
        <h1 className="text-sm font-semibold">{league.name}</h1>
        <Badge variant="outline">
          {league.settings.teams} teams · {league.settings.rounds} rounds · {league.settings.scoring.reception} PPR · {league.settings.pickTimerSeconds}s clock
        </Badge>
        <Badge variant={complete ? "outline" : "success"}>{complete ? "draft complete" : "running in browser"}</Badge>
        <Button size="sm" variant="ghost" onClick={() => sandbox.reset()}>
          <RotateCcw /> New draft
        </Button>
        {message !== "" ? <span className="text-[11px] text-muted-foreground">{message}</span> : null}
      </div>
      <div className="desk-grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
        <PanelErrorBoundary label="Clock">
          <ClockPanel league={league} snapshot={snapshot} policy={policy} userOnClock={sandbox.userOnClock} />
        </PanelErrorBoundary>
        <PanelErrorBoundary label="Control">
          <ControlPanel
            runner={runner}
            policy={policy}
            pending={false}
            error=""
            automation={NO_AUTOMATION}
            isSandbox
            onStart={sandbox.resume}
            onStop={sandbox.pause}
            onModeChange={sandbox.setMode}
            onPolicyChange={sandbox.updatePolicy}
            onManualPick={sandbox.registerManualPick}
            onRefresh={sandbox.forceTick}
            onLaunchBrowser={() => undefined}
          />
        </PanelErrorBoundary>
        <PanelErrorBoundary label="Run radar">
          <RunAlertsPanel alerts={snapshot ? snapshot.runAlerts : []} opponents={snapshot ? snapshot.opponentNeeds : []} />
        </PanelErrorBoundary>
        <PanelErrorBoundary label="Roster">
          <RosterPanel roster={snapshot ? snapshot.userRoster : []} needs={snapshot ? snapshot.rosterNeeds : []} />
        </PanelErrorBoundary>
      </div>
      <div className="desk-grid grid-cols-1 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <PanelErrorBoundary label="Recommendations">
            <RecommendationsTable
              recommendations={snapshot ? snapshot.recommendations : []}
              queue={policy.queue}
              avoid={policy.avoidPlayerIds}
              canPick={sandbox.userOnClock}
              onQueue={(id) => sandbox.updatePolicy({ queue: policy.queue.includes(id) ? policy.queue.filter((entry) => entry !== id) : [...policy.queue, id] })}
              onAvoid={(id) => sandbox.updatePolicy({ avoidPlayerIds: policy.avoidPlayerIds.includes(id) ? policy.avoidPlayerIds.filter((entry) => entry !== id) : [...policy.avoidPlayerIds, id] })}
              onPick={(id) => setMessage(sandbox.userPick(id))}
            />
          </PanelErrorBoundary>
        </div>
        <PanelErrorBoundary label="Tiers">
          <TierPanel tiers={snapshot ? snapshot.tiers : []} picksUntilUserTurn={snapshot ? snapshot.picksUntilUserTurn : 0} />
        </PanelErrorBoundary>
      </div>
      <div className="desk-grid grid-cols-1 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <PanelErrorBoundary label="Available">
            <AvailableTable
              available={snapshot ? snapshot.available : []}
              queue={policy.queue}
              avoid={policy.avoidPlayerIds}
              canPick={sandbox.userOnClock}
              onQueue={(id) => sandbox.updatePolicy({ queue: policy.queue.includes(id) ? policy.queue.filter((entry) => entry !== id) : [...policy.queue, id] })}
              onAvoid={(id) => sandbox.updatePolicy({ avoidPlayerIds: policy.avoidPlayerIds.includes(id) ? policy.avoidPlayerIds.filter((entry) => entry !== id) : [...policy.avoidPlayerIds, id] })}
              onPick={(id) => setMessage(sandbox.userPick(id))}
            />
          </PanelErrorBoundary>
        </div>
        <div className="flex flex-col gap-2">
          <PanelErrorBoundary label="Draft board">
            <DraftBoard picks={picks} teams={teamsList} userTeamId={league.userTeamId} teamsCount={league.settings.teams} />
          </PanelErrorBoundary>
          <PanelErrorBoundary label="Events">
            <EventLog events={sandbox.events} />
          </PanelErrorBoundary>
        </div>
      </div>
    </div>
  );
}
