import { describe, expect, it } from "vitest";
import { buildAuthorizeUrl, draftStateFromDomHtml, defaultYahooSettings, parseDraftHtml, parseDraftResults, parseTeams, parseTokenResponse, tokenIsExpiring } from "@/lib/integrations/yahoo";

const html = `
<html><head><script>var x = "<li class='pick'>ignored</li>";</script></head><body>
<div class="draft-header"><span class="timer">1:23</span><div class="on-clock">Blitz Brigade</div><div class="my-team">Turf Titans</div></div>
<ul class="draft-results">
  <li class="draft-pick" data-pick="1"><span class="pick-number">Pick 1</span><span class="player-name">Ja'Marr Chase</span><span class="pos">CIN - WR</span><span class="team-name">Gridiron Ghosts</span></li>
  <li class="draft-pick" data-pick="2"><span class="pick-number">Pick 2</span><span class="player-name">Bijan Robinson</span><span class="pos">ATL - RB</span><span class="team-name">Blitz Brigade</span></li>
  <li class="draft-pick" data-pick="3"><span class="pick-number">Pick 3</span><span class="player-name">Saquon Barkley</span><span class="pos">PHI - RB</span><span class="team-name">Turf Titans</span></li>
</ul>
<table><tr class="player-row available"><td class="name">Justin Jefferson</td><td>MIN - WR</td></tr><tr class="player-row available"><td class="name">Brock Bowers</td><td>LV - TE</td></tr></table>
</body></html>`;

describe("yahoo dom parser", () => {
  it("extracts picks, clock, on-clock team and available players from a structural tree", () => {
    const snapshot = parseDraftHtml(html);
    expect(snapshot.picks).toHaveLength(3);
    expect(snapshot.picks[0]?.playerName).toBe("Ja'Marr Chase");
    expect(snapshot.picks[1]?.position).toBe("RB");
    expect(snapshot.picks[2]?.teamName).toBe("Turf Titans");
    expect(snapshot.secondsRemaining).toBe(83);
    expect(snapshot.onClockTeamName).toBe("Blitz Brigade");
    expect(snapshot.userTeamName).toBe("Turf Titans");
    expect(snapshot.available.map((player) => player.playerName)).toEqual(["Justin Jefferson", "Brock Bowers"]);
  });

  it("builds a draft state from the DOM fallback", () => {
    const state = draftStateFromDomHtml("449.l.1", html, defaultYahooSettings(10), [], 100000);
    expect(state.provider).toBe("yahoo");
    expect(state.picks).toHaveLength(3);
    expect(state.picks[0]?.playerId).toBe("jamarr-chase");
    expect(state.clock.currentPickOverall).toBe(4);
    expect(state.clock.pickDeadlineAt).toBe(100000 + 83000);
    expect(state.userTeamId).not.toBe("");
  });
});

describe("yahoo oauth and api parsing", () => {
  it("builds the authorize URL and parses token responses", () => {
    const url = buildAuthorizeUrl({ consumerKey: "key", consumerSecret: "secret", redirectUri: "http://localhost:3000/cb" }, "state1");
    expect(url).toContain("client_id=key");
    expect(url).toContain("scope=fspt-r");
    expect(url).toContain("state=state1");
    expect(parseTokenResponse({ access_token: "a", refresh_token: "r", expires_in: 3600 }).expires_in).toBe(3600);
    expect(() => parseTokenResponse({})).toThrow();
    expect(tokenIsExpiring(1000, 2000)).toBe(true);
    expect(tokenIsExpiring(5_000_000, 1000)).toBe(false);
  });

  it("parses draft results and teams from the nested Yahoo JSON shape", () => {
    const raw = {
      fantasy_content: {
        league: [
          { league_key: "449.l.1", name: "Yahoo Test", num_teams: 10 },
          {
            draft_results: {
              "0": { draft_result: { pick: 1, round: 1, team_key: "449.l.1.t.1", player_key: "449.p.100" } },
              "1": { draft_result: { pick: 2, round: 1, team_key: "449.l.1.t.2", player_key: "449.p.200" } },
              count: 2,
            },
          },
          {
            teams: {
              "0": { team: [[{ team_key: "449.l.1.t.1" }, { name: "One" }, { draft_position: 1 }, { is_owned_by_current_login: 1 }]] },
              "1": { team: [[{ team_key: "449.l.1.t.2" }, { name: "Two" }, { draft_position: 2 }]] },
              count: 2,
            },
          },
        ],
      },
    };
    const results = parseDraftResults(raw);
    expect(results).toHaveLength(2);
    expect(results[1]?.playerKey).toBe("449.p.200");
    const teams = parseTeams(raw);
    expect(teams[0]?.isOwnedByCurrentLogin).toBe(true);
    expect(teams[1]?.name).toBe("Two");
  });
});

describe("yahoo player lookup and presets", () => {
  it("normalizes bare league ids into league keys", async () => {
    const { normalizeYahooLeagueKey, parsePlayers } = await import("@/lib/integrations/yahoo/client");
    expect(normalizeYahooLeagueKey("305040")).toBe("nfl.l.305040");
    expect(normalizeYahooLeagueKey("461.l.305040")).toBe("461.l.305040");
    const players = parsePlayers({
      fantasy_content: {
        league: [
          { league_key: "nfl.l.305040" },
          {
            players: {
              "0": { player: [[{ player_key: "461.p.100" }, { name: { full: "Ja'Marr Chase" } }, { display_position: "WR" }, { editorial_team_abbr: "Cin" }]] },
              count: 1,
            },
          },
        ],
      },
    });
    expect(players).toEqual([{ playerKey: "461.p.100", fullName: "Ja'Marr Chase", position: "WR", team: "CIN" }]);
  });

  it("maps api picks through the player lookup into the pool", async () => {
    const { mapYahooApiPicks, defaultYahooSettings } = await import("@/lib/integrations/yahoo");
    const { buildPlayerPool } = await import("@/lib/data/player-pool");
    const settings = defaultYahooSettings(12);
    const players = new Map([["461.p.100", { playerKey: "461.p.100", fullName: "Ja'Marr Chase", position: "WR", team: "CIN" }], ["461.p.200", { playerKey: "461.p.200", fullName: "Unknown Rookie", position: "RB", team: "DAL" }]]);
    const picks = mapYahooApiPicks([{ pick: 1, round: 1, teamKey: "t1", playerKey: "461.p.100" }, { pick: 2, round: 1, teamKey: "t2", playerKey: "461.p.200" }], settings, players, buildPlayerPool(settings.scoring));
    expect(picks[0]?.playerId).toBe("jamarr-chase");
    expect(picks[1]?.playerName).toBe("Unknown Rookie");
    expect(picks[1]?.position).toBe("RB");
  });

  it("encodes The Dudes preset with superflex, full PPR, 16 rounds and a 60 second clock", async () => {
    const { findPreset } = await import("@/lib/data/league-presets");
    const { computeReplacementLevels } = await import("@/lib/engine");
    const { buildPlayerPool } = await import("@/lib/data/player-pool");
    const preset = findPreset("yahoo-the-dudes-305040");
    expect(preset).not.toBeNull();
    expect(preset!.settings.rounds).toBe(16);
    expect(preset!.settings.rosterPositions.filter((slot) => slot !== "IR")).toHaveLength(16);
    expect(preset!.settings.pickTimerSeconds).toBe(60);
    expect(preset!.settings.scoring.reception).toBe(1);
    const levels = computeReplacementLevels(buildPlayerPool(preset!.settings.scoring), preset!.settings);
    expect(levels.startersByPosition.QB).toBeGreaterThan(12);
  });
});
