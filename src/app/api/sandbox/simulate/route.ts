import { handle, jsonOk, parseBody } from "@/lib/api/respond";
import { stressTestSchema } from "@/lib/api/schemas";
import { newId } from "@/lib/db/store";
import { simulationsTable } from "@/lib/db/tables";
import { publish } from "@/lib/events/bus";
import { runStressTest } from "@/lib/sandbox/simulator";
import { DEFAULT_RUNNER_POLICY } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const input = await parseBody(request, stressTestSchema);
    const simulationId = newId("sim");
    const policy = { ...DEFAULT_RUNNER_POLICY, ...input.policy, mode: "autopilot" as const };
    let lastReported = 0;
    const result = runStressTest(input.simulations, input.config, policy, (completed, total) => {
      if (completed - lastReported >= Math.max(25, Math.floor(total / 40)) || completed === total) {
        lastReported = completed;
        publish({ type: "sandbox.progress", simulationId, completedPicks: completed, totalPicks: total, at: Date.now() });
      }
    });
    publish({ type: "sandbox.complete", simulationId, durationMs: result.durationMs, picksPerSecond: result.picksPerSecond, at: Date.now() });
    const first = result.userRosters[0];
    await simulationsTable.upsert({
      id: simulationId,
      label: `${input.simulations}x ${input.config.teams}-team ${input.config.rounds}-round`,
      teams: input.config.teams,
      rounds: input.config.rounds,
      userSlot: input.config.userSlot,
      durationMs: result.durationMs,
      picksPerSecond: result.picksPerSecond,
      userRosterJson: JSON.stringify(first ? first.roster : []),
      createdAt: Date.now(),
      errors: result.errors,
    });
    return jsonOk({ simulationId, ...result });
  });
}

export async function GET(): Promise<Response> {
  return handle(async () => {
    const rows = await simulationsTable.all();
    return jsonOk(rows.sort((a, b) => b.createdAt - a.createdAt).slice(0, 25));
  });
}
