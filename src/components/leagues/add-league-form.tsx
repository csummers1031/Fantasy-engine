"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { addLeagueAction, type ActionState } from "@/app/actions/leagues";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LeagueSettings, Provider } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

const INITIAL: ActionState = { ok: false, message: "", leagueId: "" };

const HINTS: Record<Provider, { idLabel: string; idHint: string; teamHint: string }> = {
  sleeper: { idLabel: "League ID", idHint: "18-digit id from the Sleeper league URL", teamHint: "Roster ID (auto-resolved from your username)" },
  espn: { idLabel: "League ID", idHint: "leagueId query parameter on fantasy.espn.com", teamHint: "Team ID (auto-resolved from SWID)" },
  yahoo: { idLabel: "League key", idHint: "e.g. 449.l.123456", teamHint: "Team key (auto-resolved after OAuth)" },
};

export interface LeaguePresetOption {
  id: string;
  externalLeagueId: string;
  name: string;
  season: number;
  draftTime: string;
  settings: LeagueSettings;
}

export function AddLeagueForm({ provider, presets = [] }: { provider: Provider; presets?: LeaguePresetOption[] }) {
  const [state, action, pending] = useActionState(addLeagueAction, INITIAL);
  const [preset, setPreset] = useState<LeaguePresetOption | null>(null);
  const router = useRouter();
  useEffect(() => {
    if (state.ok) {
      router.refresh();
    }
  }, [state, router]);
  const hint = HINTS[provider];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Add league</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-2">
          <input type="hidden" name="provider" value={provider} />
          {preset ? <input type="hidden" name="settingsJson" value={JSON.stringify(preset.settings)} /> : null}
          {presets.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Presets</span>
              {presets.map((option) => (
                <Button key={option.id} type="button" size="sm" variant={preset?.id === option.id ? "default" : "outline"} onClick={() => setPreset(preset?.id === option.id ? null : option)}>
                  {option.name}
                </Button>
              ))}
              {preset ? (
                <Badge variant="info">
                  {preset.settings.teams} teams · {preset.settings.rounds} rounds · {preset.settings.scoring.reception} PPR · {preset.settings.pickTimerSeconds}s clock · {preset.settings.rosterPositions.includes("SUPER_FLEX") ? "superflex" : "1QB"}
                </Badge>
              ) : null}
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="externalLeagueId">{hint.idLabel}</Label>
              <Input key={preset ? preset.id : "manual-id"} id="externalLeagueId" name="externalLeagueId" placeholder={hint.idHint} defaultValue={preset ? preset.externalLeagueId : ""} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="name">Display name</Label>
              <Input key={preset ? `${preset.id}-name` : "manual-name"} id="name" name="name" placeholder="Optional" defaultValue={preset ? preset.name : ""} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label htmlFor="season">Season</Label>
              <Input key={preset ? `${preset.id}-season` : "manual-season"} id="season" name="season" type="number" defaultValue={preset ? preset.season : new Date().getFullYear()} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="draftId">Draft ID</Label>
              <Input id="draftId" name="draftId" placeholder="auto" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="userTeamId">Your team</Label>
              <Input id="userTeamId" name="userTeamId" placeholder={hint.teamHint} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Syncing" : "Add and sync"}
            </Button>
            {state.message !== "" ? <span className={state.ok ? "text-[11px] text-desk-up" : "text-[11px] text-desk-down"}>{state.message}</span> : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
