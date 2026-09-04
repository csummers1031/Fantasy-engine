import { notFound } from "next/navigation";
import { WarRoom } from "@/components/war-room/war-room";
import { leaguesTable, settingsTable } from "@/lib/db/tables";
import { analysisForLeague } from "@/lib/leagues/service";
import { findRunnerForLeague } from "@/lib/automation/manager";
import { automationCapability } from "@/lib/automation/runtime";
import { DEFAULT_SETTINGS } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function WarRoomPage({ params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params;
  const league = await leaguesTable.get(leagueId);
  if (!league) {
    notFound();
  }
  const runner = findRunnerForLeague(leagueId);
  const analysis = runner && runner.snapshot ? { snapshot: runner.snapshot, source: "runner" as const, error: "" } : await analysisForLeague(leagueId, runner ? runner.record.policy : undefined, false).then((result) => ({ snapshot: result.snapshot, source: result.source, error: result.error }));
  const settings = (await settingsTable.get("global")) ?? DEFAULT_SETTINGS;
  return (
    <WarRoom
      league={league}
      initialSnapshot={analysis.snapshot}
      initialSource={analysis.source}
      initialError={analysis.error}
      initialRunner={runner ? { ...runner.record, source: runner.source } : null}
      automation={automationCapability()}
      audioAlerts={settings.audioAlerts}
      defaultBuffer={settings.defaultSafeBufferSeconds}
      defaultPoll={settings.defaultPollIntervalMs}
    />
  );
}
