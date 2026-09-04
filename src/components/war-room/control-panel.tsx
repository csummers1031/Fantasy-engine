"use client";

import { Bot, Eye, Hand, MonitorPlay, Pause, Play, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { AutomationCapability } from "@/lib/automation/runtime";
import type { RunnerPolicy, RunnerRecord } from "@/lib/types";

interface ControlPanelProps {
  runner: (RunnerRecord & { source: string }) | null;
  policy: RunnerPolicy;
  pending: boolean;
  error: string;
  automation: AutomationCapability;
  isSandbox: boolean;
  onStart: () => void;
  onStop: () => void;
  onModeChange: (mode: "copilot" | "autopilot") => void;
  onPolicyChange: (policy: Partial<RunnerPolicy>) => void;
  onManualPick: () => void;
  onRefresh: () => void;
  onLaunchBrowser: () => void;
}

export function ControlPanel({ runner, policy, pending, error, automation, isSandbox, onStart, onStop, onModeChange, onPolicyChange, onManualPick, onRefresh, onLaunchBrowser }: ControlPanelProps) {
  const running = runner !== null && runner.status !== "stopped";
  const statusVariant = runner === null ? "outline" : runner.status === "running" ? "success" : runner.status === "degraded" ? "critical" : runner.status === "error" ? "warning" : "outline";
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Runner control</CardTitle>
        <div className="flex items-center gap-1">
          <Badge variant={statusVariant}>{runner ? runner.status : "idle"}</Badge>
          {runner ? <Badge variant="outline">{runner.source}</Badge> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1">
          {running ? (
            <Button size="sm" variant="destructive" onClick={onStop} disabled={pending}>
              <Pause /> Stop
            </Button>
          ) : (
            <Button size="sm" variant="success" onClick={onStart} disabled={pending}>
              <Play /> Start co-pilot
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={onRefresh} disabled={pending}>
            <RefreshCw /> Sync
          </Button>
          {!isSandbox ? (
            <Button size="sm" variant="outline" onClick={onLaunchBrowser} disabled={pending || !automation.supported} title={automation.supported ? "Open a persistent Chromium session with remote debugging" : automation.reason}>
              <MonitorPlay /> Browser
            </Button>
          ) : null}
          <Button size="sm" variant="outline" onClick={onManualPick} disabled={!running || pending} title="Tell autopilot you are picking this turn by hand">
            <Hand /> I pick manually
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-1">
          <Button size="sm" variant={policy.mode === "copilot" ? "default" : "outline"} onClick={() => onModeChange("copilot")} disabled={pending}>
            <Eye /> Co-pilot
          </Button>
          <Button size="sm" variant={policy.mode === "autopilot" ? "warning" : "outline"} onClick={() => onModeChange("autopilot")} disabled={pending || (!isSandbox && !automation.supported)} title={!isSandbox && !automation.supported ? automation.reason : "Autopilot clicks the draft button when the buffer expires"}>
            <Bot /> Autopilot
          </Button>
        </div>
        {runner && runner.degradedReason !== "" ? <div className="rounded border border-desk-down/40 bg-desk-down/10 p-2 text-[11px] text-red-200">Self-healing fallback engaged: {runner.degradedReason}</div> : null}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label>Safe buffer</Label>
            <span className="mono text-xs">{policy.safeTimeBufferSeconds}s</span>
          </div>
          <Slider min={3} max={60} step={1} value={[policy.safeTimeBufferSeconds]} onValueChange={(value) => onPolicyChange({ safeTimeBufferSeconds: value[0] ?? policy.safeTimeBufferSeconds })} />
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label>Poll interval</Label>
            <span className="mono text-xs">{policy.pollIntervalMs}ms</span>
          </div>
          <Slider min={500} max={10000} step={250} value={[policy.pollIntervalMs]} onValueChange={(value) => onPolicyChange({ pollIntervalMs: value[0] ?? policy.pollIntervalMs })} />
        </div>
        <div className="flex items-center justify-between">
          <Label>Queue beats value</Label>
          <Switch checked={policy.preferQueueOverValue} onCheckedChange={(checked) => onPolicyChange({ preferQueueOverValue: checked })} />
        </div>
        {runner ? (
          <div className="grid grid-cols-3 gap-1 text-[11px] text-muted-foreground">
            <div>
              ticks <span className="mono text-foreground">{runner.tickCount}</span>
            </div>
            <div>
              actions <span className="mono text-foreground">{runner.actionCount}</span>
            </div>
            <div className="truncate" title={runner.lastError}>
              {runner.lastError !== "" ? <span className="text-desk-warn">{runner.lastError}</span> : "healthy"}
            </div>
          </div>
        ) : null}
        {error !== "" ? <div className="text-[11px] text-desk-down">{error}</div> : null}
      </CardContent>
    </Card>
  );
}
