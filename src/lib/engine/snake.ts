import { AppError } from "@/lib/errors";

export interface PickCoordinates {
  overall: number;
  round: number;
  pickInRound: number;
  slot: number;
}

export function assertDraftShape(teams: number, rounds: number): void {
  if (!Number.isInteger(teams) || teams < 2 || teams > 32) {
    throw new AppError("VALIDATION", "teams must be an integer between 2 and 32", { details: { teams } });
  }
  if (!Number.isInteger(rounds) || rounds < 1 || rounds > 40) {
    throw new AppError("VALIDATION", "rounds must be an integer between 1 and 40", { details: { rounds } });
  }
}

export function slotForOverall(overall: number, teams: number, draftType: "snake" | "linear" | "auction" = "snake"): number {
  if (!Number.isInteger(overall) || overall < 1) {
    throw new AppError("VALIDATION", "overall pick must be a positive integer", { details: { overall } });
  }
  const round = Math.ceil(overall / teams);
  const indexInRound = (overall - 1) % teams;
  if (draftType === "snake" && round % 2 === 0) {
    return teams - indexInRound;
  }
  return indexInRound + 1;
}

export function coordinatesForOverall(overall: number, teams: number, draftType: "snake" | "linear" | "auction" = "snake"): PickCoordinates {
  const round = Math.ceil(overall / teams);
  const pickInRound = ((overall - 1) % teams) + 1;
  return { overall, round, pickInRound, slot: slotForOverall(overall, teams, draftType) };
}

export function overallForSlot(slot: number, round: number, teams: number, draftType: "snake" | "linear" | "auction" = "snake"): number {
  if (slot < 1 || slot > teams) {
    throw new AppError("VALIDATION", "slot is outside the league size", { details: { slot, teams } });
  }
  const base = (round - 1) * teams;
  if (draftType === "snake" && round % 2 === 0) {
    return base + (teams - slot + 1);
  }
  return base + slot;
}

export function computeSnakeOrder(teams: number, rounds: number, draftType: "snake" | "linear" | "auction" = "snake"): PickCoordinates[] {
  assertDraftShape(teams, rounds);
  const order: PickCoordinates[] = [];
  const total = teams * rounds;
  for (let overall = 1; overall <= total; overall += 1) {
    order.push(coordinatesForOverall(overall, teams, draftType));
  }
  return order;
}

export function userPickOveralls(slot: number, teams: number, rounds: number, draftType: "snake" | "linear" | "auction" = "snake"): number[] {
  assertDraftShape(teams, rounds);
  const overalls: number[] = [];
  for (let round = 1; round <= rounds; round += 1) {
    overalls.push(overallForSlot(slot, round, teams, draftType));
  }
  return overalls;
}

export function nextUserPick(currentOverall: number, slot: number, teams: number, rounds: number, draftType: "snake" | "linear" | "auction" = "snake"): number {
  const overalls = userPickOveralls(slot, teams, rounds, draftType);
  for (const overall of overalls) {
    if (overall >= currentOverall) {
      return overall;
    }
  }
  return -1;
}

export function picksUntilUserTurn(currentOverall: number, slot: number, teams: number, rounds: number, draftType: "snake" | "linear" | "auction" = "snake"): number {
  const next = nextUserPick(currentOverall, slot, teams, rounds, draftType);
  if (next < 0) {
    return -1;
  }
  return next - currentOverall;
}

export function slotsBetween(currentOverall: number, userSlot: number, teams: number, rounds: number, draftType: "snake" | "linear" | "auction" = "snake"): number[] {
  const next = nextUserPick(currentOverall, userSlot, teams, rounds, draftType);
  if (next < 0) {
    return [];
  }
  const slots: number[] = [];
  for (let overall = currentOverall; overall < next; overall += 1) {
    slots.push(slotForOverall(overall, teams, draftType));
  }
  return slots;
}

export function picksBetweenUserTurns(userSlot: number, teams: number, round: number, draftType: "snake" | "linear" | "auction" = "snake"): number {
  const current = overallForSlot(userSlot, round, teams, draftType);
  const next = overallForSlot(userSlot, round + 1, teams, draftType);
  return next - current - 1;
}
