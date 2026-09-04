export interface SleeperLeague {
  league_id: string;
  name: string;
  season: string;
  status: string;
  total_rosters: number;
  roster_positions: string[];
  scoring_settings: Record<string, number>;
  draft_id: string;
  settings: Record<string, number>;
}

export interface SleeperUser {
  user_id: string;
  username: string;
  display_name: string;
  metadata: { team_name?: string } | null;
}

export interface SleeperRoster {
  roster_id: number;
  owner_id: string | null;
  players: string[] | null;
}

export interface SleeperDraft {
  draft_id: string;
  league_id: string;
  status: "pre_draft" | "drafting" | "paused" | "complete";
  type: "snake" | "linear" | "auction";
  start_time: number | null;
  last_picked: number | null;
  settings: { teams: number; rounds: number; pick_timer: number; slots_qb?: number; slots_rb?: number; slots_wr?: number; slots_te?: number; slots_flex?: number; slots_k?: number; slots_def?: number; slots_bn?: number; slots_super_flex?: number };
  draft_order: Record<string, number> | null;
  slot_to_roster_id: Record<string, number> | null;
}

export interface SleeperPick {
  round: number;
  roster_id: number;
  player_id: string;
  picked_by: string;
  pick_no: number;
  draft_slot: number;
  is_keeper: boolean | null;
  metadata: { first_name?: string; last_name?: string; position?: string; team?: string };
}
