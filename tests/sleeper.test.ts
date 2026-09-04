import { describe, expect, it } from "vitest";
import { buildDraftState, mapLeagueSettings, mapPicks, mapRosterPositions, mapScoring, parseDraft, parseLeague, parsePick } from "@/lib/integrations/sleeper";
import { buildPlayerPool } from "@/lib/data/player-pool";

const leagueRaw = {
  league_id: "1234",
  name: "Test League",
  season: "2026",
  status: "in_season",
  total_rosters: 12,
  roster_positions: ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "K", "DEF", "BN", "BN", "BN", "BN", "BN", "BN"],
  scoring_settings: { pass_yd: 0.04, pass_td: 4, pass_int: -1, rush_yd: 0.1, rush_td: 6, rec_yd: 0.1, rec_td: 6, rec: 0.5, fum_lost: -2, bonus_rec_te: 0.5 },
  draft_id: "d1",
  settings: { playoff_teams: 6 },
};

const draftRaw = {
  draft_id: "d1",
  league_id: "1234",
  status: "drafting",
  type: "snake",
  start_time: 1000,
  last_picked: 5000,
  settings: { teams: 12, rounds: 15, pick_timer: 90 },
  draft_order: { u1: 1, u2: 2, u5: 5 },
  slot_to_roster_id: { "1": 1, "2": 2, "5": 5 },
};

describe("sleeper parsing", () => {
  it("parses league payloads including roster positions and scoring", () => {
    const league = parseLeague(leagueRaw);
    expect(league.draft_id).toBe("d1");
    expect(league.roster_positions).toHaveLength(15);
    expect(mapRosterPositions(league.roster_positions)).toContain("FLEX");
    const scoring = mapScoring(league.scoring_settings);
    expect(scoring.reception).toBe(0.5);
    expect(scoring.passingYardsPerPoint).toBe(25);
    expect(scoring.tePremium).toBe(0.5);
  });

  it("parses drafts and picks then builds draft state with clock and user team", () => {
    const league = parseLeague(leagueRaw);
    const draft = parseDraft(draftRaw);
    expect(draft.settings.teams).toBe(12);
    const pool = buildPlayerPool();
    const picks = [
      parsePick({ round: 1, roster_id: 1, player_id: "s1", picked_by: "u1", pick_no: 1, draft_slot: 1, metadata: { first_name: "Ja'Marr", last_name: "Chase", position: "WR", team: "CIN" } }),
      parsePick({ round: 1, roster_id: 2, player_id: "s2", picked_by: "u2", pick_no: 2, draft_slot: 2, metadata: { first_name: "Bijan", last_name: "Robinson", position: "RB", team: "ATL" } }),
    ];
    const settings = mapLeagueSettings(league, draft);
    const mapped = mapPicks(picks, settings, pool);
    expect(mapped[0]?.playerId).toBe("jamarr-chase");
    expect(mapped[1]?.position).toBe("RB");
    const state = buildDraftState({
      league,
      draft,
      picks,
      users: [
        { user_id: "u1", username: "one", display_name: "One", metadata: { team_name: "Team One" } },
        { user_id: "u5", username: "five", display_name: "Five", metadata: null },
      ],
      rosters: [
        { roster_id: 1, owner_id: "u1", players: null },
        { roster_id: 5, owner_id: "u5", players: null },
      ],
      userId: "u5",
      pool,
      now: 10000,
    });
    expect(state.userTeamId).toBe("5");
    expect(state.teams).toHaveLength(12);
    expect(state.clock.currentPickOverall).toBe(3);
    expect(state.clock.onClockTeamId).toBe("3");
    expect(state.clock.pickDeadlineAt).toBe(5000 + 90000);
    expect(state.teams.find((team) => team.slot === 1)?.name).toBe("Team One");
  });
});
