import { describe, expect, it } from "vitest";
import { DRAFT_BUTTON_CHAIN, playerRowChain, resolveFirst } from "@/lib/automation/selectors";
import { serializeDomScript } from "@/lib/automation/dom-snapshot";
import { AppError } from "@/lib/errors";
import type { Locator, Page } from "playwright-core";

function fakeScope(visibleSelectors: Set<string>): Page {
  const scope = {
    locator(selector: string) {
      const locator = {
        first: () => locator,
        waitFor: async () => {
          if (!visibleSelectors.has(selector)) {
            throw new Error(`no match for ${selector}`);
          }
        },
      } as unknown as Locator;
      return locator;
    },
  };
  return scope as unknown as Page;
}

describe("self-healing selectors", () => {
  it("includes the mandated structural selectors", () => {
    expect(DRAFT_BUTTON_CHAIN.selectors).toContain('button:has-text("Draft")');
    expect(DRAFT_BUTTON_CHAIN.selectors.some((selector) => selector.includes('[data-testid*="draft"]'))).toBe(true);
    expect(DRAFT_BUTTON_CHAIN.selectors).toContain(".player-pick-action");
  });

  it("falls through the chain to the first visible selector", async () => {
    const scope = fakeScope(new Set([".player-pick-action"]));
    const resolved = await resolveFirst(scope, DRAFT_BUTTON_CHAIN);
    expect(resolved.selector).toBe(".player-pick-action");
    expect(resolved.attempted.length).toBeGreaterThan(1);
  });

  it("raises a SELECTOR_FAILURE with the attempted list when nothing matches", async () => {
    const scope = fakeScope(new Set());
    await expect(resolveFirst(scope, playerRowChain('Ja"Marr Chase'))).rejects.toSatisfy((error: unknown) => error instanceof AppError && error.code === "SELECTOR_FAILURE" && Array.isArray(error.details.attempted) && (error.details.attempted as string[]).length === 8);
  });

  it("emits a DOM serialization script bounded by node count", () => {
    const script = serializeDomScript(1234);
    expect(script).toContain("const MAX = 1234");
    expect(script).toContain("document.body");
  });
});
