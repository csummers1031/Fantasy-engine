import type { Page } from "playwright-core";
import { AppError } from "@/lib/errors";
import { CONFIRM_BUTTON_CHAIN, DRAFT_BUTTON_CHAIN, SEARCH_INPUT_CHAIN, playerRowChain, resolveFirst, resolveOptional } from "./selectors";

export interface DraftActionResult {
  success: boolean;
  selectorUsed: string;
  rowSelector: string;
  detail: string;
  attempted: string[];
}

export async function executeDraftClick(page: Page, playerName: string): Promise<DraftActionResult> {
  const attempted: string[] = [];
  const search = await resolveOptional(page, SEARCH_INPUT_CHAIN);
  if (search) {
    try {
      await search.locator.fill(playerName, { timeout: 1500 });
      await page.waitForTimeout(350);
    } catch {
      // search is optional; the row may already be visible
    }
  }
  let row;
  try {
    row = await resolveFirst(page, playerRowChain(playerName));
  } catch (error) {
    const appError = AppError.from(error, "SELECTOR_FAILURE");
    const tried = Array.isArray(appError.details.attempted) ? (appError.details.attempted as string[]) : [];
    throw new AppError("SELECTOR_FAILURE", `Player row for ${playerName} not found`, { details: { attempted: [...attempted, ...tried] }, cause: error });
  }
  attempted.push(...row.attempted);
  await row.locator.scrollIntoViewIfNeeded({ timeout: 1500 }).catch(() => undefined);
  await row.locator.hover({ timeout: 800 }).catch(() => undefined);
  let button;
  try {
    button = await resolveFirst(row.locator, DRAFT_BUTTON_CHAIN);
  } catch (rowScoped) {
    attempted.push(...(rowScoped instanceof AppError && Array.isArray(rowScoped.details.attempted) ? (rowScoped.details.attempted as string[]) : []));
    try {
      await row.locator.click({ timeout: 800 });
      button = await resolveFirst(page, DRAFT_BUTTON_CHAIN);
    } catch (pageScoped) {
      const tried = pageScoped instanceof AppError && Array.isArray(pageScoped.details.attempted) ? (pageScoped.details.attempted as string[]) : [];
      throw new AppError("SELECTOR_FAILURE", `Draft action for ${playerName} not found`, { details: { attempted: [...attempted, ...tried] }, cause: pageScoped });
    }
  }
  attempted.push(...button.attempted);
  await button.locator.click({ timeout: 1500 });
  const confirm = await resolveOptional(page, CONFIRM_BUTTON_CHAIN);
  if (confirm) {
    await confirm.locator.click({ timeout: 1000 }).catch(() => undefined);
  }
  return { success: true, selectorUsed: button.selector, rowSelector: row.selector, detail: `Clicked ${button.selector} inside ${row.selector}`, attempted };
}
