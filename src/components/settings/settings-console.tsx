"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteCredentialAction } from "@/app/actions/credentials";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/hooks/use-api";
import type { CredentialSummary } from "@/lib/db/credentials";
import type { SettingsRecord } from "@/lib/types";

interface HealthResponse {
  status: string;
  dataDir: string;
  automation: { supported: boolean; reason: string; executablePath: string };
  usingFallbackEncryptionKey: boolean;
  streamListeners: number;
  version: string;
}

export function SettingsConsole({ settings, credentials, health }: { settings: SettingsRecord; credentials: CredentialSummary[]; health: HealthResponse }) {
  const [current, setCurrent] = useState(settings);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const save = async (patch: Partial<SettingsRecord>): Promise<void> => {
    try {
      const updated = await apiRequest<SettingsRecord>("/api/settings", { method: "PATCH", body: JSON.stringify(patch) });
      setCurrent(updated);
      setMessage("Saved.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : String(caught));
    }
  };

  return (
    <div className="desk-grid grid-cols-1 xl:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>Alerts and defaults</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <Label>Audio alerts</Label>
            <Switch checked={current.audioAlerts} onCheckedChange={(checked) => void save({ audioAlerts: checked })} />
          </div>
          <div className="space-y-1">
            <Label>Default safe buffer (seconds)</Label>
            <Input type="number" min={1} max={600} value={current.defaultSafeBufferSeconds} onChange={(event) => setCurrent({ ...current, defaultSafeBufferSeconds: Number(event.target.value) })} onBlur={() => void save({ defaultSafeBufferSeconds: current.defaultSafeBufferSeconds })} />
          </div>
          <div className="space-y-1">
            <Label>Default poll interval (ms)</Label>
            <Input type="number" min={500} max={60000} step={250} value={current.defaultPollIntervalMs} onChange={(event) => setCurrent({ ...current, defaultPollIntervalMs: Number(event.target.value) })} onBlur={() => void save({ defaultPollIntervalMs: current.defaultPollIntervalMs })} />
          </div>
          {message !== "" ? <div className="text-[11px] text-muted-foreground">{message}</div> : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Stored credentials</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-xs">
          {credentials.length === 0 ? <div className="text-muted-foreground">None stored.</div> : null}
          {credentials.map((credential) => (
            <div key={credential.id} className="flex items-center gap-2 rounded border border-desk-line px-2 py-1">
              <Badge variant="outline" className="capitalize">
                {credential.provider}
              </Badge>
              <span className="truncate font-mono text-[10px] text-muted-foreground">{Object.entries(credential.masked).map(([key, value]) => `${key}=${value}`).join(" ")}</span>
              <Button
                size="icon"
                variant="ghost"
                className="ml-auto h-6 w-6"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await deleteCredentialAction(credential.id);
                    setMessage(result.message);
                    router.refresh();
                  })
                }
              >
                <Trash2 />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>System health</CardTitle>
          <Badge variant="success">{health.status}</Badge>
        </CardHeader>
        <CardContent className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Version</span>
            <span className="mono">{health.version}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Data directory</span>
            <span className="mono truncate">{health.dataDir}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Automation</span>
            <Badge variant={health.automation.supported ? "success" : "warning"}>{health.automation.supported ? "ready" : "unavailable"}</Badge>
          </div>
          {!health.automation.supported ? <div className="text-[11px] text-muted-foreground">{health.automation.reason}</div> : null}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Encryption key</span>
            <Badge variant={health.usingFallbackEncryptionKey ? "warning" : "success"}>{health.usingFallbackEncryptionKey ? "fallback (set CREDENTIAL_ENCRYPTION_KEY)" : "configured"}</Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Stream listeners</span>
            <span className="mono">{health.streamListeners}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
