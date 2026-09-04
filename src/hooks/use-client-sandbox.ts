"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { analyzeDraft, decideAutopilotPick } from "@/lib/engine";
import { SandboxDraft, type SandboxConfig } from "@/lib/sandbox/simulator";
import type { AnalysisSnapshot, DraftState, EngineEvent, LeagueRecord, RunnerPolicy, RunnerRecord } from "@/lib/types";
import { DEFAULT_RUNNER_POLICY } from "@/lib/types";

export interface ClientSandboxConfig {
  teams: number;
  rounds: number;
  userSlot: number;
  pickTimerSeconds: number;
  botDelayMinMs: number;
  botDelayMaxMs: number;
  seed: number;
}

interface PersistedSandbox {
  config: ClientSandboxConfig;
  policy: RunnerPolicy;
  picks: Array<{ teamId: string; playerId: string; timestamp: number }>;
  running: boolean;
  tickCount: number;
  actionCount: number;
  savedAt: number;
}

export interface ClientSandboxApi {
  ready: boolean;
  league: LeagueRecord | null;
  state: DraftState | null;
  snapshot: AnalysisSnapshot | null;
  runner: (RunnerRecord & { source: string }) | null;
  policy: RunnerPolicy;
  events: EngineEvent[];
  userOnClock: boolean;
  start: (config: ClientSandboxConfig, policy: Partial<RunnerPolicy>) => void;
  resume: () => void;
  pause: () => void;
  reset: () => void;
  setMode: (mode: "copilot" | "autopilot") => void;
  updatePolicy: (patch: Partial<RunnerPolicy>) => void;
  registerManualPick: () => void;
  userPick: (playerId: string) => string;
  forceTick: () => void;
}

const STORAGE_KEY = "fantasy-engine.client-sandbox.v1";
const TICK_MS = 1000;
const MAX_EVENTS = 300;

function readPersisted(): PersistedSandbox | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as PersistedSandbox;
    if (!parsed.config || !Array.isArray(parsed.picks)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writePersisted(value: PersistedSandbox | null): void {
  try {
    if (value === null) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    }
  } catch {
    // storage is best-effort
  }
}

function buildLeague(draft: SandboxDraft, config: ClientSandboxConfig): LeagueRecord {
  const now = Date.now();
  return {
    id: `client_${draft.id}`,
    provider: "sleeper",
    externalLeagueId: draft.id,
    name: `Live sandbox · ${config.teams} teams · you pick ${config.userSlot}`,
    season: new Date().getFullYear(),
    draftId: draft.id,
    userTeamId: draft.userTeamId,
    settings: draft.settings,
    createdAt: now,
    updatedAt: now,
    lastSyncAt: now,
    lastSyncError: "",
  };
}

export function useClientSandbox(): ClientSandboxApi {
  const draftRef = useRef<SandboxDraft | null>(null);
  const configRef = useRef<ClientSandboxConfig | null>(null);
  const policyRef = useRef<RunnerPolicy>({ ...DEFAULT_RUNNER_POLICY, pollIntervalMs: TICK_MS });
  const runningRef = useRef(false);
  const manualPickOverallRef = useRef(-1);
  const actedOverallRef = useRef(-1);
  const seenAlertsRef = useRef(new Set<string>());
  const countersRef = useRef({ ticks: 0, actions: 0, startedAt: 0 });
  const [ready, setReady] = useState(false);
  const [version, setVersion] = useState(0);
  const [events, setEvents] = useState<EngineEvent[]>([]);
  const [snapshot, setSnapshot] = useState<AnalysisSnapshot | null>(null);
  const [state, setState] = useState<DraftState | null>(null);
  const [policy, setPolicyState] = useState<RunnerPolicy>(policyRef.current);

  const pushEvent = useCallback((event: EngineEvent) => {
    setEvents((previous) => {
      const next = [...previous, event];
      return next.length > MAX_EVENTS ? next.slice(next.length - MAX_EVENTS) : next;
    });
  }, []);

  const persist = useCallback(() => {
    const draft = draftRef.current;
    const config = configRef.current;
    if (!draft || !config) {
      writePersisted(null);
      return;
    }
    writePersisted({
      config,
      policy: policyRef.current,
      picks: draft.picks.map((pick) => ({ teamId: pick.teamId, playerId: pick.playerId, timestamp: pick.timestamp })),
      running: runningRef.current,
      tickCount: countersRef.current.ticks,
      actionCount: countersRef.current.actions,
      savedAt: Date.now(),
    });
  }, []);

  const recompute = useCallback(
    (now: number) => {
      const draft = draftRef.current;
      if (!draft) {
        setSnapshot(null);
        setState(null);
        return;
      }
      const draftState = draft.state(now);
      const analysis = analyzeDraft({ state: draftState, playerPool: draft.pool, policy: policyRef.current, now });
      for (const alert of analysis.runAlerts) {
        if (!seenAlertsRef.current.has(alert.id)) {
          seenAlertsRef.current.add(alert.id);
          pushEvent({ type: "run.alert", leagueId: `client_${draft.id}`, alert, at: now });
        }
      }
      setState(draftState);
      setSnapshot(analysis);
      return analysis;
    },
    [pushEvent],
  );

  const attachDraft = useCallback(
    (draft: SandboxDraft) => {
      draftRef.current = draft;
      let lastCount = draft.picks.length;
      draft.onChange((draftState) => {
        const now = Date.now();
        if (draftState.picks.length > lastCount) {
          for (const pick of draftState.picks.slice(lastCount)) {
            const team = draftState.teams.find((candidate) => candidate.id === pick.teamId);
            pushEvent({ type: "draft.pick", leagueId: `client_${draft.id}`, overall: pick.overall, playerName: pick.playerName, teamName: team ? team.name : pick.teamId, at: now });
          }
          lastCount = draftState.picks.length;
        }
        recompute(now);
        persist();
        setVersion((value) => value + 1);
      });
    },
    [persist, pushEvent, recompute],
  );

  const tick = useCallback(() => {
    const draft = draftRef.current;
    if (!draft || !runningRef.current) {
      return;
    }
    const now = Date.now();
    countersRef.current.ticks += 1;
    if (draft.isComplete) {
      runningRef.current = false;
      draft.stopLiveBots();
      pushEvent({ type: "system.notice", level: "info", message: "Sandbox draft complete.", audio: false, at: now });
      recompute(now);
      persist();
      setVersion((value) => value + 1);
      return;
    }
    const analysis = recompute(now);
    const draftState = draft.state(now);
    const userOnClock = draft.isUserOnClock();
    const overall = draftState.clock.currentPickOverall;
    if (userOnClock && now >= draftState.clock.pickDeadlineAt) {
      const pick = policyRef.current.mode === "autopilot" ? draft.autoPickForUser(policyRef.current, now) : draft.platformAutoPick(now);
      pushEvent({ type: "system.notice", level: "warning", message: `Clock expired. ${policyRef.current.mode === "autopilot" ? "Engine" : "Platform auto-draft"} selected ${pick.playerName}.`, audio: true, at: now });
      return;
    }
    if (userOnClock && analysis) {
      const decision = decideAutopilotPick({
        now,
        pickDeadlineAt: draftState.clock.pickDeadlineAt,
        isUserOnClock: true,
        manualPickMade: manualPickOverallRef.current === overall || actedOverallRef.current === overall,
        policy: policyRef.current,
        recommendations: analysis.recommendations,
        available: analysis.available,
      });
      if (decision.shouldAct && decision.player) {
        actedOverallRef.current = overall;
        draft.makeUserPick(decision.player.id, now);
        countersRef.current.actions += 1;
        pushEvent({ type: "autopilot.action", runnerId: "client", leagueId: `client_${draft.id}`, playerName: decision.player.name, success: true, detail: decision.reason, at: now });
      }
    }
    setVersion((value) => value + 1);
  }, [persist, pushEvent, recompute]);

  useEffect(() => {
    const persisted = readPersisted();
    if (persisted) {
      const draft = new SandboxDraft(`sandbox_client_${persisted.config.seed}`, persisted.config as Partial<SandboxConfig>, Date.now());
      configRef.current = persisted.config;
      policyRef.current = { ...DEFAULT_RUNNER_POLICY, ...persisted.policy, pollIntervalMs: TICK_MS };
      setPolicyState(policyRef.current);
      countersRef.current = { ticks: persisted.tickCount, actions: persisted.actionCount, startedAt: persisted.savedAt };
      draft.replay(persisted.picks);
      draft.resetClock(Date.now());
      attachDraft(draft);
      runningRef.current = persisted.running && !draft.isComplete;
      if (runningRef.current) {
        draft.startLiveBots();
      }
      recompute(Date.now());
      pushEvent({ type: "system.notice", level: "info", message: `Restored sandbox with ${draft.picks.length} picks from this device.`, audio: false, at: Date.now() });
    }
    setReady(true);
    const interval = setInterval(tick, TICK_MS);
    return () => {
      clearInterval(interval);
      draftRef.current?.stopLiveBots();
    };
  }, [attachDraft, pushEvent, recompute, tick]);

  const start = useCallback(
    (config: ClientSandboxConfig, policyPatch: Partial<RunnerPolicy>) => {
      draftRef.current?.stopLiveBots();
      const draft = new SandboxDraft(`sandbox_client_${config.seed}`, config, Date.now());
      configRef.current = config;
      policyRef.current = { ...DEFAULT_RUNNER_POLICY, ...policyPatch, pollIntervalMs: TICK_MS };
      setPolicyState(policyRef.current);
      countersRef.current = { ticks: 0, actions: 0, startedAt: Date.now() };
      manualPickOverallRef.current = -1;
      actedOverallRef.current = -1;
      seenAlertsRef.current = new Set();
      setEvents([]);
      attachDraft(draft);
      runningRef.current = true;
      draft.startLiveBots();
      recompute(Date.now());
      persist();
      pushEvent({ type: "runner.mode", runnerId: "client", mode: policyRef.current.mode, reason: "sandbox started in browser", at: Date.now() });
      setVersion((value) => value + 1);
    },
    [attachDraft, persist, pushEvent, recompute],
  );

  const pause = useCallback(() => {
    runningRef.current = false;
    draftRef.current?.stopLiveBots();
    persist();
    setVersion((value) => value + 1);
  }, [persist]);

  const resume = useCallback(() => {
    const draft = draftRef.current;
    if (!draft || draft.isComplete) {
      return;
    }
    runningRef.current = true;
    draft.resetClock(Date.now());
    draft.startLiveBots();
    persist();
    setVersion((value) => value + 1);
  }, [persist]);

  const reset = useCallback(() => {
    draftRef.current?.stopLiveBots();
    draftRef.current = null;
    configRef.current = null;
    runningRef.current = false;
    setSnapshot(null);
    setState(null);
    setEvents([]);
    writePersisted(null);
    setVersion((value) => value + 1);
  }, []);

  const updatePolicy = useCallback(
    (patch: Partial<RunnerPolicy>) => {
      policyRef.current = { ...policyRef.current, ...patch, pollIntervalMs: TICK_MS };
      setPolicyState(policyRef.current);
      persist();
      recompute(Date.now());
    },
    [persist, recompute],
  );

  const setMode = useCallback(
    (mode: "copilot" | "autopilot") => {
      updatePolicy({ mode });
      pushEvent({ type: "runner.mode", runnerId: "client", mode, reason: "operator toggle", at: Date.now() });
    },
    [pushEvent, updatePolicy],
  );

  const registerManualPick = useCallback(() => {
    const draft = draftRef.current;
    if (draft) {
      manualPickOverallRef.current = draft.state().clock.currentPickOverall;
      pushEvent({ type: "system.notice", level: "info", message: "Autopilot standing down for this pick. You are drafting by hand.", audio: false, at: Date.now() });
    }
  }, [pushEvent]);

  const userPick = useCallback(
    (playerId: string): string => {
      const draft = draftRef.current;
      if (!draft) {
        return "No sandbox running";
      }
      try {
        const pick = draft.makeUserPick(playerId, Date.now());
        return `Drafted ${pick.playerName}`;
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
    },
    [],
  );

  const forceTick = useCallback(() => {
    recompute(Date.now());
    setVersion((value) => value + 1);
  }, [recompute]);

  const league = useMemo(() => (draftRef.current && configRef.current ? buildLeague(draftRef.current, configRef.current) : null), [version]);
  const runner = useMemo<(RunnerRecord & { source: string }) | null>(() => {
    const draft = draftRef.current;
    if (!draft) {
      return null;
    }
    return {
      id: "client",
      leagueId: `client_${draft.id}`,
      provider: "sleeper",
      status: draft.isComplete ? "stopped" : runningRef.current ? "running" : "stopped",
      policy: policyRef.current,
      lastTickAt: Date.now(),
      lastError: "",
      tickCount: countersRef.current.ticks,
      actionCount: countersRef.current.actions,
      degradedReason: "",
      startedAt: countersRef.current.startedAt,
      stoppedAt: 0,
      source: "browser",
    };
  }, [version, policy]);

  const userOnClock = draftRef.current ? draftRef.current.isUserOnClock() : false;

  return { ready, league, state, snapshot, runner, policy, events, userOnClock, start, resume, pause, reset, setMode, updatePolicy, registerManualPick, userPick, forceTick };
}
