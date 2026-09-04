"use client";

import { useState } from "react";
import { ExternalLink, FileCode2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/hooks/use-api";
import type { DomDraftSnapshot } from "@/lib/integrations/yahoo/types";

export function YahooOAuthPanel({ hasCredential }: { hasCredential: boolean }) {
  const [message, setMessage] = useState("");
  const [html, setHtml] = useState("");
  const [snapshot, setSnapshot] = useState<DomDraftSnapshot | null>(null);
  return (
    <Card>
      <CardHeader>
        <CardTitle>OAuth 2.0 and DOM fallback</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        <div className="flex items-center gap-2">
          <Button size="sm" disabled={!hasCredential} onClick={async () => {
            try {
              const result = await apiRequest<{ url: string; redirectUri: string }>("/api/yahoo/oauth/authorize");
              window.open(result.url, "_blank", "noopener");
              setMessage(`Authorize window opened. Redirect URI registered with Yahoo must equal ${result.redirectUri}.`);
            } catch (caught) {
              setMessage(caught instanceof Error ? caught.message : String(caught));
            }
          }}>
            <ExternalLink /> Start OAuth
          </Button>
          {!hasCredential ? <span className="text-[11px] text-muted-foreground">Save consumer key and secret first.</span> : null}
        </div>
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Fallback: paste draft room HTML to test the structural parser</div>
          <Textarea value={html} onChange={(event) => setHtml(event.target.value)} placeholder="<ul class='draft-picks'>...</ul>" className="min-h-[80px] font-mono text-[10px]" />
          <Button size="sm" variant="outline" disabled={html.trim() === ""} onClick={async () => {
            try {
              const result = await apiRequest<{ snapshot: DomDraftSnapshot }>("/api/yahoo/dom/parse", { method: "POST", body: JSON.stringify({ html, leagueKey: "yahoo-dom-test", teams: 10 }) });
              setSnapshot(result.snapshot);
              setMessage(`Parsed ${result.snapshot.picks.length} picks, clock ${result.snapshot.secondsRemaining}s, on clock: ${result.snapshot.onClockTeamName || "unknown"}`);
            } catch (caught) {
              setMessage(caught instanceof Error ? caught.message : String(caught));
            }
          }}>
            <FileCode2 /> Parse DOM
          </Button>
        </div>
        {snapshot && snapshot.picks.length > 0 ? (
          <div className="max-h-32 overflow-auto rounded border border-desk-line p-2 font-mono text-[10px]">
            {snapshot.picks.map((pick) => (
              <div key={pick.overall}>
                #{pick.overall} {pick.playerName} {pick.position} {pick.teamName ? `-> ${pick.teamName}` : ""}
              </div>
            ))}
          </div>
        ) : null}
        {message !== "" ? <div className="text-[11px] text-muted-foreground">{message}</div> : null}
      </CardContent>
    </Card>
  );
}
