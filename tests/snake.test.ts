import { describe, expect, it } from "vitest";
import { computeSnakeOrder, coordinatesForOverall, nextUserPick, overallForSlot, picksBetweenUserTurns, picksUntilUserTurn, slotForOverall, slotsBetween, userPickOveralls } from "@/lib/engine/snake";

describe("snake indexing", () => {
  it("maps overall picks to slots in a 12 team snake", () => {
    expect(slotForOverall(1, 12)).toBe(1);
    expect(slotForOverall(12, 12)).toBe(12);
    expect(slotForOverall(13, 12)).toBe(12);
    expect(slotForOverall(24, 12)).toBe(1);
    expect(slotForOverall(25, 12)).toBe(1);
  });

  it("maps overall picks linearly for linear drafts", () => {
    expect(slotForOverall(13, 12, "linear")).toBe(1);
    expect(slotForOverall(24, 12, "linear")).toBe(12);
  });

  it("computes coordinates and inverse mapping consistently", () => {
    for (let overall = 1; overall <= 180; overall += 1) {
      const coordinates = coordinatesForOverall(overall, 12);
      expect(overallForSlot(coordinates.slot, coordinates.round, 12)).toBe(overall);
    }
  });

  it("produces user pick overalls for slot 5", () => {
    expect(userPickOveralls(5, 12, 4)).toEqual([5, 20, 29, 44]);
  });

  it("computes picks until the user turn", () => {
    expect(picksUntilUserTurn(1, 5, 12, 15)).toBe(4);
    expect(picksUntilUserTurn(5, 5, 12, 15)).toBe(0);
    expect(picksUntilUserTurn(6, 5, 12, 15)).toBe(14);
    expect(picksUntilUserTurn(181, 5, 12, 15)).toBe(-1);
    expect(nextUserPick(21, 5, 12, 15)).toBe(29);
  });

  it("lists opponent slots between now and the user turn", () => {
    expect(slotsBetween(6, 5, 12, 15)).toEqual([6, 7, 8, 9, 10, 11, 12, 12, 11, 10, 9, 8, 7, 6]);
    expect(picksBetweenUserTurns(1, 12, 1)).toBe(22);
    expect(picksBetweenUserTurns(12, 12, 1)).toBe(0);
  });

  it("generates a full order with the right length", () => {
    const order = computeSnakeOrder(10, 16);
    expect(order).toHaveLength(160);
    expect(order[9]?.slot).toBe(10);
    expect(order[10]?.slot).toBe(10);
  });

  it("rejects invalid shapes", () => {
    expect(() => computeSnakeOrder(1, 10)).toThrow();
    expect(() => slotForOverall(0, 12)).toThrow();
  });
});
