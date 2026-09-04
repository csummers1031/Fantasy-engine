export interface EspnCookies {
  swid: string;
  espnS2: string;
}

export interface EspnLeagueResponse {
  id: number;
  seasonId: number;
  settings: {
    name: string;
    size: number;
    rosterSettings: { lineupSlotCounts: Record<string, number> };
    scoringSettings: { scoringItems: Array<{ statId: number; points: number }> };
    draftSettings: { type: string; pickOrder: number[]; timePerSelection: number; date: number };
  };
  draftDetail: {
    drafted: boolean;
    inProgress: boolean;
    picks: Array<{ overallPickNumber: number; roundId: number; roundPickNumber: number; teamId: number; playerId: number; autoDraftTypeId: number }>;
  };
  teams: Array<{ id: number; name: string; abbrev: string; owners: string[] }>;
  members: Array<{ id: string; displayName: string }>;
}

export interface EspnPlayerInfo {
  id: number;
  fullName: string;
  defaultPositionId: number;
  proTeamId: number;
  injuryStatus: string;
  averageDraftPosition: number;
}
