import { handle, jsonOk, parseBody } from "@/lib/api/respond";
import { liveSandboxSchema } from "@/lib/api/schemas";
import { leaguesTable } from "@/lib/db/tables";
import { createLiveSandbox, listLiveSandboxes } from "@/lib/sandbox/registry";
import { startRunner } from "@/lib/automation/manager";
import type { LeagueRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return handle(async () =>
    jsonOk(
      listLiveSandboxes().map((draft) => ({
        id: draft.id,
        picks: draft.picks.length,
        totalPicks: draft.totalPicks,
        complete: draft.isComplete,
        userOnClock: draft.isUserOnClock(),
      })),
    ),
  );
}

export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const input = await parseBody(request, liveSandboxSchema);
    const draft = createLiveSandbox(input.config);
    const now = Date.now();
    const league: LeagueRecord = {
      id: `lg_${draft.id}`,
      provider: "sleeper",
      externalLeagueId: draft.id,
      name: `Sandbox ${input.config.teams}-team (slot ${input.config.userSlot})`,
      season: new Date().getFullYear(),
      draftId: draft.id,
      userTeamId: draft.userTeamId,
      settings: draft.settings,
      createdAt: now,
      updatedAt: now,
      lastSyncAt: now,
      lastSyncError: "",
    };
    await leaguesTable.upsert(league);
    const runner = input.autoStartRunner ? await startRunner(league.id, { ...input.policy, pollIntervalMs: input.policy.pollIntervalMs ?? 1000 }, "sandbox") : null;
    return jsonOk({ sandboxId: draft.id, league, runner });
  });
}
