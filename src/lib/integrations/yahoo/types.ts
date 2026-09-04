export interface YahooOAuthConfig {
  consumerKey: string;
  consumerSecret: string;
  redirectUri: string;
}

export interface YahooTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface YahooDraftResult {
  pick: number;
  round: number;
  teamKey: string;
  playerKey: string;
}

export interface YahooLeagueSettings {
  leagueKey: string;
  name: string;
  numTeams: number;
  draftType: string;
  draftTime: number;
  rosterPositions: Array<{ position: string; count: number }>;
  statModifiers: Array<{ statId: number; value: number }>;
}

export interface YahooTeam {
  teamKey: string;
  name: string;
  draftPosition: number;
  isOwnedByCurrentLogin: boolean;
}

export interface DomNode {
  tag: string;
  text: string;
  attrs: Record<string, string>;
  children: DomNode[];
}

export interface DomDraftPick {
  overall: number;
  teamName: string;
  playerName: string;
  position: string;
  team: string;
}

export interface DomDraftSnapshot {
  picks: DomDraftPick[];
  onClockTeamName: string;
  secondsRemaining: number;
  userTeamName: string;
  available: Array<{ playerName: string; position: string; team: string }>;
}
