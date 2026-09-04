"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PanelErrorBoundary } from "@/components/error-boundary";
import { useEventStream } from "@/hooks/use-event-stream";
import { useAudioAlert } from "@/hooks/use-audio-alert";
import { apiRequest } from "@/hooks/use-api";
import type { AutomationCapability } from "@/lib/automation/runtime";
import type { AnalysisSnapshot, DraftState, EngineEvent, LeagueRecord, RunnerPolicy, RunnerRecord } from "@/lib/types";
import { DEFAULT_RUNNER_POLICY } from "@/lib/types";
import { ClockPanel } from "./clock-panel";
import { ControlPanel } from "./control-panel";
import { RecommendationsTable } from "./recommendations-table";
import { TierPanel } from "./tier-panel";
import { RunAlertsPanel } from "./run-alerts-panel";
import { RosterPanel } from "./roster-panel";
import { DraftBoard } from "./draft-board";
import { EventLog } from "./event-log";
import { AvailableTable } from "./available-table";

type RunnerWithSource = RunnerRecord & { source: string };

interface WarRoomProps {
  league: LeagueRecord;
  initialSnapshot: AnalysisSnapshot | null;
  initialSource: "runner" | "sync" | "cache" | "none";
  initialError: string;
  initialRunner: RunnerWithSource | null;
  automation: AutomationCapability;
  audioAlerts: boolean;
  defaultBuffer: number;
  defaultPoll: number;
}

interface AnalysisResponse {
  league: LeagueRecord;
  snapshot: AnalysisSnapshot | null;
  state: DraftState | null;
  source: "runner" | "sync" | "cache" | "none";
  error: string;
}

export function WarRoom({ league, initialSnapshot, initialSource, initialError, initialRunner, automation, audioAlerts, defaultBuffer, defaultPoll }: WarRoomProps) {
  const isSandbox = league.externalLeagueId.startsWith("sandbox_");
  const [snapshot, setSnapshot] = useState<AnalysisSnapshot | null>(initialSnapshot);
  const [state, setState] = useState<DraftState | null>(null);
  const [runner, setRunner] = useState<RunnerWithSource | null>(initialRunner);
  const [policy, setPolicy] = useState<RunnerPolicy>(initialRunner ? initialRunner.policy : { ...DEFAULT_RUNNER_POLICY, safeTimeBufferSeconds: defaultBuffer, pollIntervalMs: defaultPoll });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(initialError);
  const [source, setSource] = useState(initialSource);
  const playTone = useAudioAlert(audioAlerts);

  const handleEvent = useCallback(
    (event: EngineEvent) => {
      if (event.type === "draft.snapshot" && event.leagueId === league.id) {
        setSnapshot(event.snapshot);
        setSource("runner");
      } else if (event.type === "runner.status" && event.runner.leagueId === league.id) {
        setRunner((previous) => ({ ...event.runner, source: previous ? previous.source : isSandbox ? "sandbox" : "api" }));
        setPolicy(event.runner.policy);
      } else if (event.type === "runner.mode" && runner && event.runnerId === runner.id) {
        setPolicy((previous) => ({ ...previous, mode: event.mode }));
        if (event.mode === "copilot" && event.reason.startsWith("Self-healing")) {
          playTone("critical");
        }
      } else if (event.type === "run.alert" && event.leagueId === league.id && event.alert.severity === "critical") {
        playTone("warning");
      } else if (event.type === "autopilot.action" && event.leagueId === league.id) {
        playTone(event.success ? "info" : "critical");
      } else if (event.type === "draft.pick" && event.leagueId === league.id) {
        void refreshState();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [league.id, runner, isSandbox, playTone],
  );

  const { events } = useEventStream(handleEvent);

  const refreshState = useCallback(async (): Promise<void> => {
    try {
      const result = await apiRequest<AnalysisResponse>(`/api/leagues/${league.id}/analysis`);
      setState(result.state);
      if (result.snapshot) {
        setSnapshot(result.snapshot);
        setSource(result.source);
      }
      setError(result.error);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }, [league.id]);

  useEffect(() => {
    void refreshState();
  }, [refreshState]);

  const withPending = useCallback(async (operation: () => Promise<void>): Promise<void> => {
    setPending(true);
    setError("");
    try {
      await operation();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setPending(false);
    }
  }, []);

  const startRunner = (): void => {
    void withPending(async () => {
      const record = await apiRequest<RunnerRecord>("/api/runners", { method: "POST", body: JSON.stringify({ leagueId: league.id, policy, source: isSandbox ? "sandbox" : undefined }) });
      setRunner({ ...record, source: isSandbox ? "sandbox" : "api" });
      setPolicy(record.policy);
    });
  };

  const stopRunner = (): void => {
    if (!runner) {
      return;
    }
    void withPending(async () => {
      const record = await apiRequest<RunnerRecord>(`/api/runners/${runner.id}`, { method: "DELETE" });
      setRunner({ ...record, source: runner.source });
    });
  };

  const changeMode = (mode: "copilot" | "autopilot"): void => {
    setPolicy((previous) => ({ ...previous, mode }));
    if (!runner || runner.status === "stopped") {
      return;
    }
    void withPending(async () => {
      const record = await apiRequest<RunnerRecord>(`/api/runners/${runner.id}/mode`, { method: "POST", body: JSON.stringify({ mode, reason: "operator toggle" }) });
      setRunner({ ...record, source: runner.source });
      setPolicy(record.policy);
    });
  };

  const changePolicy = (patch: Partial<RunnerPolicy>): void => {
    const next = { ...policy, ...patch };
    setPolicy(next);
    if (!runner || runner.status === "stopped") {
      return;
    }
    void apiRequest<RunnerRecord>(`/api/runners/${runner.id}/policy`, { method: "PATCH", body: JSON.stringify(patch) }).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : String(caught)));
  };

  const toggleQueue = (playerId: string): void => {
    const queue = policy.queue.includes(playerId) ? policy.queue.filter((id) => id !== playerId) : [...policy.queue, playerId];
    changePolicy({ queue });
  };

  const toggleAvoid = (playerId: string): void => {
    const avoidPlayerIds = policy.avoidPlayerIds.includes(playerId) ? policy.avoidPlayerIds.filter((id) => id !== playerId) : [...policy.avoidPlayerIds, playerId];
    changePolicy({ avoidPlayerIds });
  };

  const manualPick = (): void => {
    if (!runner) {
      return;
    }
    void withPending(async () => {
      await apiRequest<RunnerRecord>(`/api/runners/${runner.id}/manual-pick`, { method: "POST" });
    });
  };

  const launchBrowser = (): void => {
    void withPending(async () => {
      await apiRequest("/api/browser/launch", { method: "POST", body: JSON.stringify({ provider: league.provider, targetUrl: "" }) });
    });
  };

  const sandboxPick = (playerId: string): void => {
    void withPending(async () => {
      await apiRequest(`/api/sandbox/live/${league.externalLeagueId}/pick`, { method: "POST", body: JSON.stringify({ playerId }) });
      await refreshState();
    });
  };

  const userOnClock = useMemo(() => {
    if (!snapshot) {
      return false;
    }
    return snapshot.picksUntilUserTurn === 0;
  }, [snapshot]);

  const picks = state ? state.picks : [];
  const teams = state ? state.teams : [];
  const canPick = isSandbox && userOnClock;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild size="sm" variant="ghost">
          <Link href={`/leagues/${league.provider}`}>
            <ArrowLeft /> {league.provider}
          </Link>
        </Button>
        <h1 className="text-sm font-semibold">{league.name}</h1>
        <Badge variant="outline">
          {league.settings.teams} teams · {league.settings.rounds} rounds · {league.settings.scoring.reception} PPR · {league.settings.draftType}
        </Badge>
        <Badge variant={source === "runner" ? "success" : source === "sync" ? "info" : "warning"}>data: {source}</Badge>
        {error !== "" ? <span className="text-[11px] text-desk-warn">{error}</span> : null}
      </div>
      <div className="desk-grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
        <PanelErrorBoundary label="Clock">
          <ClockPanel league={league} snapshot={snapshot} policy={policy} userOnClock={userOnClock} />
        </PanelErrorBoundary>
        <PanelErrorBoundary label="Control">
          <ControlPanel runner={runner} policy={policy} pending={pending} error="" automation={automation} isSandbox={isSandbox} onStart={startRunner} onStop={stopRunner} onModeChange={changeMode} onPolicyChange={changePolicy} onManualPick={manualPick} onRefresh={() => void refreshState()} onLaunchBrowser={launchBrowser} />
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
            <RecommendationsTable recommendations={snapshot ? snapshot.recommendations : []} queue={policy.queue} avoid={policy.avoidPlayerIds} canPick={canPick} onQueue={toggleQueue} onAvoid={toggleAvoid} onPick={sandboxPick} />
          </PanelErrorBoundary>
        </div>
        <PanelErrorBoundary label="Tiers">
          <TierPanel tiers={snapshot ? snapshot.tiers : []} picksUntilUserTurn={snapshot ? snapshot.picksUntilUserTurn : 0} />
        </PanelErrorBoundary>
      </div>
      <div className="desk-grid grid-cols-1 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <PanelErrorBoundary label="Available">
            <AvailableTable available={snapshot ? snapshot.available : []} queue={policy.queue} avoid={policy.avoidPlayerIds} canPick={canPick} onQueue={toggleQueue} onAvoid={toggleAvoid} onPick={sandboxPick} />
          </PanelErrorBoundary>
        </div>
        <div className="flex flex-col gap-2">
          <PanelErrorBoundary label="Draft board">
            <DraftBoard picks={picks} teams={teams} userTeamId={state ? state.userTeamId : league.userTeamId} teamsCount={league.settings.teams} />
          </PanelErrorBoundary>
          <PanelErrorBoundary label="Events">
            <EventLog events={events} />
          </PanelErrorBoundary>
        </div>
      </div>
    </div>
  );
}
