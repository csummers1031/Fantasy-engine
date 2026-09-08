import { AppError, withTimeout } from "@/lib/errors";
import { asNumber, asRecord, asString } from "../http";
import type { YahooOAuthConfig, YahooTokenResponse } from "./types";

export const YAHOO_AUTHORIZE_URL = "https://api.login.yahoo.com/oauth2/request_auth";
export const YAHOO_TOKEN_URL = "https://api.login.yahoo.com/oauth2/get_token";

export function resolveYahooConfig(overrides: Partial<YahooOAuthConfig> = {}): YahooOAuthConfig {
  return {
    consumerKey: overrides.consumerKey ?? process.env.YAHOO_CONSUMER_KEY ?? "",
    consumerSecret: overrides.consumerSecret ?? process.env.YAHOO_CONSUMER_SECRET ?? "",
    redirectUri: overrides.redirectUri ?? process.env.YAHOO_REDIRECT_URI ?? "oob",
  };
}

export function buildAuthorizeUrl(config: YahooOAuthConfig, state: string): string {
  if (!config.consumerKey) {
    throw new AppError("VALIDATION", "Yahoo consumer key is required to build the authorize URL");
  }
  const params = new URLSearchParams({
    client_id: config.consumerKey,
    redirect_uri: config.redirectUri,
    response_type: "code",
    language: "en-us",
    state,
  });
  return `${YAHOO_AUTHORIZE_URL}?${params.toString()}`;
}

function basicAuthHeader(config: YahooOAuthConfig): string {
  return `Basic ${Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString("base64")}`;
}

async function postToken(config: YahooOAuthConfig, body: URLSearchParams): Promise<YahooTokenResponse> {
  if (!config.consumerKey || !config.consumerSecret) {
    throw new AppError("VALIDATION", "Yahoo consumer key and secret are required");
  }
  const response = await withTimeout(
    fetch(YAHOO_TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: basicAuthHeader(config),
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
      cache: "no-store",
    }),
    10000,
    "Yahoo token exchange",
  ).catch((error: unknown) => {
    throw new AppError("PROVIDER_HTTP", "Yahoo token endpoint unreachable", { cause: error, retryable: true });
  });
  const text = await response.text();
  if (!response.ok) {
    throw new AppError("PROVIDER_AUTH", `Yahoo token exchange failed (${response.status})`, { details: { body: text.slice(0, 300) } });
  }
  let parsed: Record<string, unknown>;
  try {
    parsed = asRecord(JSON.parse(text));
  } catch (error) {
    throw new AppError("PROVIDER_PARSE", "Yahoo token response was not JSON", { cause: error });
  }
  return parseTokenResponse(parsed);
}

export function parseTokenResponse(parsed: Record<string, unknown>): YahooTokenResponse {
  const accessToken = asString(parsed.access_token);
  if (!accessToken) {
    throw new AppError("PROVIDER_PARSE", "Yahoo token response missing access_token");
  }
  return {
    access_token: accessToken,
    refresh_token: asString(parsed.refresh_token),
    expires_in: asNumber(parsed.expires_in, 3600),
    token_type: asString(parsed.token_type, "bearer"),
  };
}

export async function exchangeCodeForToken(config: YahooOAuthConfig, code: string): Promise<YahooTokenResponse> {
  const body = new URLSearchParams({ grant_type: "authorization_code", redirect_uri: config.redirectUri, code });
  return postToken(config, body);
}

export async function refreshAccessToken(config: YahooOAuthConfig, refreshToken: string): Promise<YahooTokenResponse> {
  const body = new URLSearchParams({ grant_type: "refresh_token", redirect_uri: config.redirectUri, refresh_token: refreshToken });
  return postToken(config, body);
}

export function tokenIsExpiring(expiresAt: number, now: number = Date.now(), skewMs: number = 60000): boolean {
  return expiresAt - skewMs <= now;
}
