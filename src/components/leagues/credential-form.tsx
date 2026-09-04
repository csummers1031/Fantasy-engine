"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";
import { saveCredentialAction, type CredentialActionState } from "@/app/actions/credentials";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Provider } from "@/lib/types";

const INITIAL: CredentialActionState = { ok: false, message: "" };

export function CredentialForm({ provider }: { provider: Provider }) {
  const [state, action, pending] = useActionState(saveCredentialAction, INITIAL);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Credentials</CardTitle>
        <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-2">
          <input type="hidden" name="provider" value={provider} />
          {provider === "sleeper" ? (
            <>
              <div className="space-y-1">
                <Label htmlFor="username">Sleeper username</Label>
                <Input id="username" name="username" placeholder="your_sleeper_handle" required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="userId">User ID (optional, resolved automatically)</Label>
                <Input id="userId" name="userId" placeholder="123456789012345678" />
              </div>
              <p className="text-[11px] text-muted-foreground">Sleeper reads are public. The username only identifies which roster is yours.</p>
            </>
          ) : null}
          {provider === "espn" ? (
            <>
              <div className="space-y-1">
                <Label htmlFor="cookieHeader">Paste full cookie header (SWID and espn_s2)</Label>
                <Textarea id="cookieHeader" name="cookieHeader" placeholder="SWID={...}; espn_s2=..." />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="swid">SWID</Label>
                  <Input id="swid" name="swid" placeholder="{XXXXXXXX-XXXX-...}" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="espnS2">espn_s2</Label>
                  <Input id="espnS2" name="espnS2" type="password" placeholder="AEB..." />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">Either paste the cookie header or the two values. Or launch the browser session below, sign in, and extract cookies automatically.</p>
            </>
          ) : null}
          {provider === "yahoo" ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="consumerKey">Consumer key</Label>
                  <Input id="consumerKey" name="consumerKey" required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="consumerSecret">Consumer secret</Label>
                  <Input id="consumerSecret" name="consumerSecret" type="password" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="accessToken">Access token (optional)</Label>
                  <Input id="accessToken" name="accessToken" type="password" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="refreshToken">Refresh token (optional)</Label>
                  <Input id="refreshToken" name="refreshToken" type="password" />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">Save the consumer key pair, then start OAuth from the button on the right. Tokens are stored encrypted.</p>
            </>
          ) : null}
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Saving" : "Save encrypted"}
            </Button>
            {state.message !== "" ? <span className={state.ok ? "text-[11px] text-desk-up" : "text-[11px] text-desk-down"}>{state.message}</span> : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
