import type { DomNode } from "@/lib/integrations/yahoo/types";
import { parseDraftDom } from "@/lib/integrations/yahoo/dom-parser";
import { buildYahooDraftState, mapDomPicks } from "@/lib/integrations/yahoo/mapper";
import { buildPlayerPool } from "@/lib/data/player-pool";
import type { DraftState, DraftTeam, LeagueRecord } from "@/lib/types";
import { activePage, getLiveSessionForProvider } from "./browser";
import { captureFrameTrees } from "./dom-snapshot";
import { AppError } from "@/lib/errors";

function mergeTrees(trees: DomNode[]): DomNode {
  return { tag: "root", text: "", attrs: {}, children: trees };
}

export async function draftStateFromPage(league: LeagueRecord, previous: DraftState | null, now: number): Promise<DraftState> {
  const session = getLiveSessionForProvider(league.provider);
  if (!session) {
    throw new AppError("BROWSER_LAUNCH", `No open browser session for ${league.provider}. Launch one from the league page first.`);
  }
  const trees = await captureFrameTrees(activePage(session));
  const snapshot = parseDraftDom(mergeTrees(trees));
  const pool = buildPlayerPool(league.settings.scoring);
  const teams: DraftTeam[] = previous && previous.teams.length > 0 ? previous.teams : [];
  if (teams.length === 0) {
    const names = new Set(snapshot.picks.map((pick) => pick.teamName).filter((name) => name !== ""));
    let slot = 1;
    for (const name of names) {
      teams.push({ id: `team-${slot}`, name, slot, ownerName: "", isUser: name === snapshot.userTeamName });
      slot += 1;
    }
    while (teams.length < league.settings.teams) {
      teams.push({ id: `team-${teams.length + 1}`, name: `Slot ${teams.length + 1}`, slot: teams.length + 1, ownerName: "", isUser: false });
    }
  }
  if (league.userTeamId !== "" && !teams.some((team) => team.isUser)) {
    const userTeam = teams.find((team) => team.id === league.userTeamId);
    if (userTeam) {
      userTeam.isUser = true;
    }
  }
  const picks = mapDomPicks(snapshot, league.settings, teams, pool);
  const total = league.settings.teams * league.settings.rounds;
  const status: DraftState["status"] = picks.length >= total ? "complete" : "drafting";
  return { ...buildYahooDraftState({ leagueKey: league.externalLeagueId, settings: league.settings, teams, picks, status, secondsRemaining: snapshot.secondsRemaining, now }), provider: league.provider, leagueId: league.externalLeagueId, draftId: league.draftId };
}
