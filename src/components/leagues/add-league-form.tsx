"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { addLeagueAction, type ActionState } from "@/app/actions/leagues";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Provider } from "@/lib/types";

const INITIAL: ActionState = { ok: false, message: "", leagueId: "" };

const HINTS: Record<Provider, { idLabel: string; idHint: string; teamHint: string }> = {
  sleeper: { idLabel: "League ID", idHint: "18-digit id from the Sleeper league URL", teamHint: "Roster ID (auto-resolved from your username)" },
  espn: { idLabel: "League ID", idHint: "leagueId query parameter on fantasy.espn.com", teamHint: "Team ID (auto-resolved from SWID)" },
  yahoo: { idLabel: "League key", idHint: "e.g. 449.l.123456", teamHint: "Team key (auto-resolved after OAuth)" },
};

export function AddLeagueForm({ provider }: { provider: Provider }) {
  const [state, action, pending] = useActionState(addLeagueAction, INITIAL);
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
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="externalLeagueId">{hint.idLabel}</Label>
              <Input id="externalLeagueId" name="externalLeagueId" placeholder={hint.idHint} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="name">Display name</Label>
              <Input id="name" name="name" placeholder="Optional" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label htmlFor="season">Season</Label>
              <Input id="season" name="season" type="number" defaultValue={new Date().getFullYear()} />
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
