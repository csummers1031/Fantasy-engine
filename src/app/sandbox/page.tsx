import { SandboxConsole } from "@/components/sandbox/sandbox-console";
import { listLiveSandboxes } from "@/lib/sandbox/registry";
import { simulationsTable } from "@/lib/db/tables";
import { listLeagues } from "@/lib/leagues/service";

export const dynamic = "force-dynamic";

export default async function SandboxPage() {
  const [simulations, leagues] = await Promise.all([simulationsTable.all(), listLeagues()]);
  const live = listLiveSandboxes().map((draft) => {
    const league = leagues.find((candidate) => candidate.externalLeagueId === draft.id);
    return { id: draft.id, leagueId: league ? league.id : `lg_${draft.id}`, name: league ? league.name : draft.id, picks: draft.picks.length, totalPicks: draft.totalPicks, complete: draft.isComplete };
  });
  const history = simulations
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 10)
    .map((row) => ({ id: row.id, label: row.label, picksPerSecond: row.picksPerSecond, durationMs: row.durationMs, errors: row.errors, createdAt: row.createdAt }));
  return <SandboxConsole liveSandboxes={live} history={history} />;
}
