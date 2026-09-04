import { describe, expect, it } from "vitest";
import { buildCookieHeader, buildEspnDraftState, leagueUrl, mapEspnScoring, mapEspnSettings, mapLineupSlots, normalizeSwid, parseCookieHeader, parseLeagueResponse, parsePlayerInfo } from "@/lib/integrations/espn";
import { buildPlayerPool } from "@/lib/data/player-pool";

describe("espn cookies", () => {
  it("parses cookie headers and normalizes SWID braces", () => {
    const cookies = parseCookieHeader("foo=bar; SWID=%7Babc-123%7D; espn_s2=AEBsecret");
    expect(cookies.swid).toBe("{ABC-123}");
    expect(cookies.espnS2).toBe("AEBsecret");
    expect(buildCookieHeader(cookies)).toBe("SWID={ABC-123}; espn_s2=AEBsecret");
    expect(normalizeSwid("abc")).toBe("{ABC}");
    expect(() => parseCookieHeader("espn_s2=only")).toThrow();
  });

  it("builds the league URL with draft views", () => {
    const url = leagueUrl(2026, "99");
    expect(url).toContain("/2026/segments/0/leagues/99?");
    expect(url).toContain("view=mDraftDetail");
    expect(url).toContain("view=mSettings");
    expect(url).toContain("view=mRoster");
  });
});

describe("espn mapping", () => {
  const raw = {
    id: 99,
    seasonId: 2026,
    settings: {
      name: "ESPN Test",
      size: 10,
      rosterSettings: { lineupSlotCounts: { "0": 1, "2": 2, "4": 2, "6": 1, "23": 1, "16": 1, "17": 1, "20": 6, "21": 1 } },
      scoringSettings: { scoringItems: [{ statId: 53, points: 1 }, { statId: 4, points: 6 }, { statId: 3, points: 0.04 }] },
      draftSettings: { type: "SNAKE", pickOrder: [3, 1, 2], timePerSelection: 60, date: 0 },
    },
    draftDetail: { drafted: false, inProgress: true, picks: [{ overallPickNumber: 1, roundId: 1, roundPickNumber: 1, teamId: 3, playerId: 4362628, autoDraftTypeId: 0 }] },
    teams: [
      { id: 1, name: "Alpha", abbrev: "ALP", owners: ["{USER-1}"] },
      { id: 2, location: "Beta", nickname: "Squad", abbrev: "BET", owners: ["{USER-2}"] },
      { id: 3, name: "Gamma", abbrev: "GAM", owners: ["{USER-3}"] },
    ],
    members: [{ id: "{USER-1}", displayName: "Owner One" }],
  };

  it("parses and maps settings, teams, picks and clock", () => {
    const league = parseLeagueResponse(raw);
    expect(league.teams[1]?.name).toBe("Beta Squad");
    const slots = mapLineupSlots(league.settings.rosterSettings.lineupSlotCounts);
    expect(slots.filter((slot) => slot === "BN")).toHaveLength(6);
    expect(slots).toContain("FLEX");
    const scoring = mapEspnScoring(league.settings.scoringSettings.scoringItems);
    expect(scoring.reception).toBe(1);
    expect(scoring.passingTd).toBe(6);
    const settings = mapEspnSettings(league);
    expect(settings.teams).toBe(10);
    expect(settings.rounds).toBe(15);
    const info = parsePlayerInfo({ players: [{ id: 4362628, player: { fullName: "Ja'Marr Chase", defaultPositionId: 3, proTeamId: 4, injuryStatus: "ACTIVE", ownership: { averageDraftPosition: 1.5 } } }] });
    const state = buildEspnDraftState({ league, playerInfo: info, pool: buildPlayerPool(), userSwid: "{USER-1}", now: 5000 });
    expect(state.userTeamId).toBe("1");
    expect(state.teams.find((team) => team.id === "3")?.slot).toBe(1);
    expect(state.picks[0]?.playerId).toBe("jamarr-chase");
    expect(state.clock.currentPickOverall).toBe(2);
    expect(state.clock.onClockTeamId).toBe("1");
    expect(state.status).toBe("drafting");
  });
});
