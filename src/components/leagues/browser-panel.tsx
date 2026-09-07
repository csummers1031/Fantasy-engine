"use client";

import { useCallback, useEffect, useState } from "react";
import { Camera, Cookie, Download, ExternalLink, MonitorPlay, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/hooks/use-api";
import type { AutomationCapability } from "@/lib/automation/runtime";
import type { BrowserSessionRecord, Provider } from "@/lib/types";

interface SessionsResponse {
  sessions: BrowserSessionRecord[];
  capability: AutomationCapability;
}

interface CookieResponse {
  provider: Provider;
  count: number;
  names: string[];
  espn: { swid: string; espnS2: string } | null;
  saved: boolean;
}

export function BrowserPanel({ provider, capability }: { provider: Provider; capability: AutomationCapability }) {
  const [sessions, setSessions] = useState<BrowserSessionRecord[]>([]);
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [snapshotId, setSnapshotId] = useState("");

  const refresh = useCallback(async () => {
    try {
      const result = await apiRequest<SessionsResponse>("/api/browser/sessions");
      setSessions(result.sessions.filter((session) => session.provider === provider));
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : String(caught));
    }
  }, [provider]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const act = async (operation: () => Promise<string>): Promise<void> => {
    setPending(true);
    try {
      setMessage(await operation());
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setPending(false);
      await refresh();
    }
  };

  const open = sessions.find((session) => session.status === "open");
  return (
    <Card>
      <CardHeader>
        <CardTitle>Persistent browser</CardTitle>
        <Badge variant={capability.supported ? "success" : "warning"}>{capability.supported ? "ready" : "unavailable"}</Badge>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        {!capability.supported ? <div className="text-[11px] text-muted-foreground">{capability.reason} Run the app locally with `npm run dev` to use browser automation.</div> : <div className="text-[11px] text-muted-foreground">Launch opens a separate Chrome window with its own profile. Sign in to {provider} inside that window once; the login persists between launches.</div>}
        <div className="flex gap-1">
          <Input placeholder="Optional draft room URL" value={url} onChange={(event) => setUrl(event.target.value)} className="h-7" />
          <Button size="sm" disabled={pending || !capability.supported} onClick={() => act(async () => {
            const session = await apiRequest<BrowserSessionRecord>("/api/browser/launch", { method: "POST", body: JSON.stringify({ provider, targetUrl: url }) });
            return `Chromium open on remote debugging port ${session.remoteDebuggingPort}. Sign in and complete any MFA in that window.`;
          })}>
            <MonitorPlay /> Launch
          </Button>
        </div>
        {open ? (
          <div className="rounded border border-desk-line p-2">
            <div className="flex items-center gap-2">
              <Badge variant="success">open</Badge>
              <span className="mono">port {open.remoteDebuggingPort}</span>
              <a className="ml-auto inline-flex items-center gap-1 text-desk-info" href={`http://127.0.0.1:${open.remoteDebuggingPort}/json`} target="_blank" rel="noreferrer">
                devtools <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="mt-1 truncate text-[10px] text-muted-foreground">{open.targetUrl}</div>
            <div className="mt-2 flex gap-1">
              {provider === "espn" ? (
                <Button size="sm" variant="outline" disabled={pending} onClick={() => act(async () => {
                  const result = await apiRequest<CookieResponse>("/api/browser/cookies", { method: "POST", body: JSON.stringify({ sessionId: open.id, save: true }) });
                  return result.espn ? `Extracted ${result.count} cookies. SWID ${result.espn.swid} saved: ${result.saved}` : `Extracted ${result.count} cookies but SWID/espn_s2 not present yet. Sign in first.`;
                })}>
                  <Cookie /> Extract cookies
                </Button>
              ) : null}
              <Button size="sm" variant="outline" disabled={pending} onClick={() => act(async () => {
                const result = await apiRequest<{ snapshot: { id: string; nodeCount: number; frameCount: number; title: string }; parsed: { picks: number; secondsRemaining: number; onClockTeamName: string; available: number } }>("/api/browser/snapshot", { method: "POST", body: JSON.stringify({ sessionId: open.id }) });
                setSnapshotId(result.snapshot.id);
                return `Captured "${result.snapshot.title}" (${result.snapshot.nodeCount} nodes, ${result.snapshot.frameCount} frames). Parser found ${result.parsed.picks} picks, ${result.parsed.available} available players, clock ${result.parsed.secondsRemaining < 0 ? "not found" : `${result.parsed.secondsRemaining}s`}, on clock: ${result.parsed.onClockTeamName || "not found"}. Download the file and send it over so the selectors can be tuned to the real page.`;
              })}>
                <Camera /> Capture draft room
              </Button>
              {snapshotId !== "" ? (
                <Button asChild size="sm" variant="outline">
                  <a href={`/api/browser/snapshot/${snapshotId}`} download>
                    <Download /> Download snapshot
                  </a>
                </Button>
              ) : null}
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => act(async () => {
                await apiRequest(`/api/browser/sessions/${open.id}`, { method: "DELETE" });
                return "Session closed. Profile cookies persist on disk.";
              })}>
                <Power /> Close
              </Button>
            </div>
          </div>
        ) : null}
        {message !== "" ? <div className="text-[11px] text-muted-foreground">{message}</div> : null}
      </CardContent>
    </Card>
  );
}
