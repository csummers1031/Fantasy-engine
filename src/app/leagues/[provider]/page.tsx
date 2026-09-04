import { notFound } from "next/navigation";
import { AddLeagueForm } from "@/components/leagues/add-league-form";
import { BrowserPanel } from "@/components/leagues/browser-panel";
import { CredentialForm } from "@/components/leagues/credential-form";
import { LeagueList } from "@/components/leagues/league-list";
import { YahooOAuthPanel } from "@/components/leagues/yahoo-oauth-panel";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { automationCapability } from "@/lib/automation/runtime";
import { listCredentialSummaries } from "@/lib/db/credentials";
import { listLeagues } from "@/lib/leagues/service";
import type { Provider } from "@/lib/types";
import { presetsForProvider } from "@/lib/data/league-presets";

export const dynamic = "force-dynamic";

const PROVIDERS: Provider[] = ["sleeper", "espn", "yahoo"];

const DESCRIPTIONS: Record<Provider, { title: string; base: string; notes: string[] }> = {
  sleeper: {
    title: "Sleeper",
    base: "https://api.sleeper.app/v1",
    notes: ["GET /league/{league_id} provides roster_positions, scoring_settings, and draft_id.", "GET /draft/{draft_id}/picks is polled every 2000 ms; snake indexes are computed locally.", "No authentication is required for reads. Autopilot clicks in the persistent browser session."],
  },
  espn: {
    title: "ESPN",
    base: "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/{season}/segments/0/leagues/{league_id}",
    notes: ["Requests carry SWID and espn_s2 cookies decrypted from storage.", "Draft boards are read with ?view=mDraftDetail&view=mSettings&view=mRoster.", "Cookies can be extracted directly from the persistent Chromium session after login."],
  },
  yahoo: {
    title: "Yahoo",
    base: "https://fantasysports.yahooapis.com/fantasy/v2",
    notes: ["OAuth 2.0 authorization code flow with consumer key and secret; tokens refresh automatically.", "Draft results are read from /league/{league_key}/draftresults.", "When the API is unavailable the runner parses the live draft room DOM tree from the browser session."],
  },
};

export default async function ProviderPage({ params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!PROVIDERS.includes(provider as Provider)) {
    notFound();
  }
  const typed = provider as Provider;
  const [leagues, credentials] = await Promise.all([listLeagues(), listCredentialSummaries()]);
  const providerLeagues = leagues.filter((league) => league.provider === typed && !league.externalLeagueId.startsWith("sandbox_"));
  const providerCredentials = credentials.filter((credential) => credential.provider === typed);
  const description = DESCRIPTIONS[typed];
  const capability = automationCapability();
  return (
    <div className="desk-grid grid-cols-1 xl:grid-cols-3">
      <div className="flex flex-col gap-2 xl:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>{description.title} pipeline</CardTitle>
            <Badge variant={providerCredentials.length > 0 ? "success" : "outline"}>{providerCredentials.length > 0 ? "credentials stored" : "no credentials"}</Badge>
          </CardHeader>
          <CardContent className="space-y-1 text-xs">
            <div className="mono break-all text-[11px] text-desk-info">{description.base}</div>
            {description.notes.map((note) => (
              <div key={note} className="text-muted-foreground">
                {note}
              </div>
            ))}
            {providerCredentials.map((credential) => (
              <div key={credential.id} className="mono text-[10px] text-muted-foreground">
                {credential.label}: {Object.entries(credential.masked).map(([key, value]) => `${key}=${value}`).join(" ")}
              </div>
            ))}
          </CardContent>
        </Card>
        <AddLeagueForm provider={typed} presets={presetsForProvider(typed)} />
        <LeagueList leagues={providerLeagues} />
      </div>
      <div className="flex flex-col gap-2">
        <CredentialForm provider={typed} />
        {typed === "yahoo" ? <YahooOAuthPanel hasCredential={providerCredentials.length > 0} /> : null}
        <BrowserPanel provider={typed} capability={capability} />
      </div>
    </div>
  );
}
