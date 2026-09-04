import type { LeagueSettings, Provider } from "@/lib/types";

export interface LeaguePreset {
  id: string;
  provider: Provider;
  externalLeagueId: string;
  name: string;
  season: number;
  draftTime: string;
  settings: LeagueSettings;
}

export const LEAGUE_PRESETS: readonly LeaguePreset[] = [
  {
    id: "yahoo-the-dudes-305040",
    provider: "yahoo",
    externalLeagueId: "nfl.l.305040",
    name: "The Dudes",
    season: 2026,
    draftTime: "2026-09-08T23:00:00Z",
    settings: {
      teams: 12,
      rounds: 16,
      rosterPositions: ["QB", "WR", "WR", "WR", "RB", "RB", "TE", "SUPER_FLEX", "K", "DEF", "BN", "BN", "BN", "BN", "BN", "BN", "IR", "IR"],
      scoring: {
        passingYardsPerPoint: 25,
        passingTd: 4,
        interception: -1,
        rushingYardsPerPoint: 10,
        rushingTd: 6,
        receivingYardsPerPoint: 10,
        receivingTd: 6,
        reception: 1,
        tePremium: 0,
        fumbleLost: -2,
      },
      draftType: "snake",
      pickTimerSeconds: 60,
    },
  },
];

export function findPreset(id: string): LeaguePreset | null {
  return LEAGUE_PRESETS.find((preset) => preset.id === id) ?? null;
}

export function presetsForProvider(provider: Provider): LeaguePreset[] {
  return LEAGUE_PRESETS.filter((preset) => preset.provider === provider);
}
