import { handle, jsonOk, parseBody } from "@/lib/api/respond";
import { startRunnerSchema } from "@/lib/api/schemas";
import { listRunners, startRunner } from "@/lib/automation/manager";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return handle(async () => jsonOk(await listRunners()));
}

export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const input = await parseBody(request, startRunnerSchema);
    const runner = await startRunner(input.leagueId, input.policy, input.source ?? "");
    return jsonOk(runner);
  });
}
