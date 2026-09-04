import type { Locator, Page } from "playwright-core";
import { AppError } from "@/lib/errors";

export interface SelectorChain {
  name: string;
  selectors: string[];
  timeoutMs: number;
}

export const DRAFT_BUTTON_CHAIN: SelectorChain = {
  name: "draftButton",
  timeoutMs: 1200,
  selectors: [
    'button:has-text("Draft")',
    '[data-testid*="draft"] button',
    '[data-testid*="draft"]',
    ".player-pick-action",
    'button[aria-label*="draft" i]',
    'button:has-text("Pick")',
    'button:has-text("Select")',
    '[class*="draft-button"]',
    '[class*="pick-button"]',
  ],
};

export const CONFIRM_BUTTON_CHAIN: SelectorChain = {
  name: "confirmButton",
  timeoutMs: 800,
  selectors: ['button:has-text("Confirm")', 'button:has-text("Yes")', '[data-testid*="confirm"]', 'button:has-text("Draft Player")'],
};

export const SEARCH_INPUT_CHAIN: SelectorChain = {
  name: "searchInput",
  timeoutMs: 1000,
  selectors: ['input[placeholder*="Search" i]', 'input[type="search"]', '[data-testid*="search"] input', 'input[aria-label*="search" i]'],
};

export const CLOCK_CHAIN: SelectorChain = {
  name: "clock",
  timeoutMs: 800,
  selectors: ['[data-testid*="timer"]', '[data-testid*="clock"]', '[class*="timer"]', '[class*="clock"]', '[class*="countdown"]'],
};

export function playerRowChain(playerName: string): SelectorChain {
  const escaped = playerName.replace(/"/g, '\\"');
  const lastName = playerName.split(" ").slice(-1)[0] ?? playerName;
  const escapedLast = lastName.replace(/"/g, '\\"');
  return {
    name: `playerRow(${playerName})`,
    timeoutMs: 1500,
    selectors: [
      `[data-testid*="player"]:has-text("${escaped}")`,
      `tr:has-text("${escaped}")`,
      `li:has-text("${escaped}")`,
      `[class*="player"]:has-text("${escaped}")`,
      `[role="row"]:has-text("${escaped}")`,
      `div:has-text("${escaped}") >> nth=-1`,
      `[data-testid*="player"]:has-text("${escapedLast}")`,
      `tr:has-text("${escapedLast}")`,
    ],
  };
}

export interface ResolvedSelector {
  locator: Locator;
  selector: string;
  attempted: string[];
}

export async function resolveFirst(scope: Page | Locator, chain: SelectorChain): Promise<ResolvedSelector> {
  const attempted: string[] = [];
  for (const selector of chain.selectors) {
    attempted.push(selector);
    try {
      const locator = scope.locator(selector).first();
      await locator.waitFor({ state: "visible", timeout: chain.timeoutMs });
      return { locator, selector, attempted };
    } catch {
      // try the next structural selector
    }
  }
  throw new AppError("SELECTOR_FAILURE", `Unable to resolve ${chain.name} with any structural selector`, {
    details: { chain: chain.name, attempted },
  });
}

export async function resolveOptional(scope: Page | Locator, chain: SelectorChain): Promise<ResolvedSelector | null> {
  try {
    return await resolveFirst(scope, chain);
  } catch {
    return null;
  }
}
