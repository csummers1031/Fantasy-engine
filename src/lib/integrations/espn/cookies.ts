import { AppError } from "@/lib/errors";
import type { EspnCookies } from "./types";

export function normalizeSwid(swid: string): string {
  const trimmed = swid.trim();
  if (trimmed === "") {
    throw new AppError("VALIDATION", "SWID is required");
  }
  const bare = trimmed.replace(/^\{|\}$/g, "");
  return `{${bare.toUpperCase()}}`;
}

export function parseCookieHeader(cookieHeader: string): EspnCookies {
  const pairs = cookieHeader.split(";").map((part) => part.trim()).filter((part) => part.includes("="));
  let swid = "";
  let espnS2 = "";
  for (const pair of pairs) {
    const separator = pair.indexOf("=");
    const key = pair.slice(0, separator).trim().toLowerCase();
    const value = pair.slice(separator + 1).trim();
    if (key === "swid") {
      swid = decodeURIComponent(value);
    }
    if (key === "espn_s2") {
      espnS2 = decodeURIComponent(value);
    }
  }
  if (!swid || !espnS2) {
    throw new AppError("VALIDATION", "Cookie header must include both SWID and espn_s2");
  }
  return { swid: normalizeSwid(swid), espnS2 };
}

export function buildCookieHeader(cookies: EspnCookies): string {
  return `SWID=${normalizeSwid(cookies.swid)}; espn_s2=${cookies.espnS2}`;
}

export function cookiesFromBrowser(cookies: Array<{ name: string; value: string }>): EspnCookies | null {
  const swid = cookies.find((cookie) => cookie.name.toUpperCase() === "SWID");
  const espnS2 = cookies.find((cookie) => cookie.name === "espn_s2");
  if (!swid || !espnS2) {
    return null;
  }
  return { swid: normalizeSwid(swid.value), espnS2: espnS2.value };
}
