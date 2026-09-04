import { loadCredential } from "@/lib/db/credentials";
import { AppError } from "@/lib/errors";
import { fetchEspnDraftState } from "@/lib/integrations/espn";
import { fetchSleeperDraftState } from "@/lib/integrations/sleeper";
import { fetchYahooDraftState, refreshAccessToken, resolveYahooConfig, tokenIsExpiring } from "@/lib/integrations/yahoo";
import { saveCredential } from "@/lib/db/credentials";
import { findLiveSandbox } from "@/lib/sandbox/registry";
import type { DraftState, LeagueRecord } from "@/lib/types";
import { draftStateFromPage } from "./page-source";

export type SourceKind = "api" | "page" | "sandbox";

export function resolveSourceKind(league: LeagueRecord): SourceKind {
  if (league.externalLeagueId.startsWith("sandbox_")) {
    return "sandbox";
  }
  return "api";
}

export async function fetchDraftStateFromApi(league: LeagueRecord): Promise<DraftState> {
  switch (league.provider) {
    case "sleeper": {
      const credential = await loadCredential("sleeper");
      const userId = credential && credential.provider === "sleeper" ? credential.data.userId : league.userTeamId;
      const state = await fetchSleeperDraftState(league.externalLeagueId, userId, league.draftId);
      if (state.userTeamId === "" && league.userTeamId !== "") {
        return { ...state, userTeamId: league.userTeamId, teams: state.teams.map((team) => ({ ...team, isUser: team.id === league.userTeamId })) };
      }
      return state;
    }
    case "espn": {
      const credential = await loadCredential("espn");
      const cookies = credential && credential.provider === "espn" ? { swid: credential.data.swid, espnS2: credential.data.espnS2 } : null;
      const state = await fetchEspnDraftState(league.season, league.externalLeagueId, cookies);
      if (state.userTeamId === "" && league.userTeamId !== "") {
        return { ...state, userTeamId: league.userTeamId, teams: state.teams.map((team) => ({ ...team, isUser: team.id === league.userTeamId })) };
      }
      return state;
    }
    case "yahoo": {
      const credential = await loadCredential("yahoo");
      if (!credential || credential.provider !== "yahoo" || credential.data.accessToken === "") {
        throw new AppError("PROVIDER_AUTH", "Yahoo OAuth token missing. Complete the OAuth flow or use the browser page source.");
      }
      let accessToken = credential.data.accessToken;
      if (tokenIsExpiring(credential.data.expiresAt) && credential.data.refreshToken !== "") {
        const config = resolveYahooConfig({ consumerKey: credential.data.consumerKey, consumerSecret: credential.data.consumerSecret });
        const refreshed = await refreshAccessToken(config, credential.data.refreshToken);
        accessToken = refreshed.access_token;
        await saveCredential(
          {
            provider: "yahoo",
            data: {
              ...credential.data,
              accessToken: refreshed.access_token,
              refreshToken: refreshed.refresh_token || credential.data.refreshToken,
              expiresAt: Date.now() + refreshed.expires_in * 1000,
            },
          },
          "oauth",
        );
      }
      const state = await fetchYahooDraftState(league.externalLeagueId, accessToken, league.settings.pickTimerSeconds);
      if (state.userTeamId === "" && league.userTeamId !== "") {
        return { ...state, userTeamId: league.userTeamId, teams: state.teams.map((team) => ({ ...team, isUser: team.id === league.userTeamId })) };
      }
      return state;
    }
  }
}

export async function fetchDraftState(league: LeagueRecord, source: SourceKind, previous: DraftState | null): Promise<DraftState> {
  const now = Date.now();
  switch (source) {
    case "sandbox": {
      const sandbox = findLiveSandbox(league.externalLeagueId);
      if (!sandbox) {
        throw new AppError("NOT_FOUND", `Sandbox ${league.externalLeagueId} is not running. Start a new live sandbox.`);
      }
      return { ...sandbox.state(now), provider: league.provider };
    }
    case "page":
      return draftStateFromPage(league, previous, now);
    case "api":
      return fetchDraftStateFromApi(league);
  }
}
