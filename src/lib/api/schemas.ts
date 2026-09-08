import { z } from "zod";

export const providerSchema = z.enum(["sleeper", "espn", "yahoo"]);
export const positionSchema = z.enum(["QB", "RB", "WR", "TE", "K", "DEF"]);
export const rosterSlotSchema = z.enum(["QB", "RB", "WR", "TE", "K", "DEF", "FLEX", "SUPER_FLEX", "REC_FLEX", "BN", "IR", "IDP_FLEX", "DL", "LB", "DB"]);

export const scoringSchema = z.object({
  passingYardsPerPoint: z.number().positive(),
  passingTd: z.number(),
  interception: z.number(),
  rushingYardsPerPoint: z.number().positive(),
  rushingTd: z.number(),
  receivingYardsPerPoint: z.number().positive(),
  receivingTd: z.number(),
  reception: z.number(),
  tePremium: z.number(),
  fumbleLost: z.number(),
});

export const leagueSettingsSchema = z.object({
  teams: z.number().int().min(2).max(32),
  rounds: z.number().int().min(1).max(40),
  rosterPositions: z.array(rosterSlotSchema).min(1),
  scoring: scoringSchema,
  draftType: z.enum(["snake", "linear", "auction"]),
  pickTimerSeconds: z.number().int().min(5).max(86400),
});

export const createLeagueSchema = z.object({
  provider: providerSchema,
  externalLeagueId: z.string().min(1).max(120),
  name: z.string().max(120).default(""),
  season: z.number().int().min(2015).max(2100).default(new Date().getFullYear()),
  draftId: z.string().max(120).default(""),
  userTeamId: z.string().max(120).default(""),
  settings: leagueSettingsSchema.optional(),
});

export const updateLeagueSchema = z.object({
  name: z.string().max(120).optional(),
  draftId: z.string().max(120).optional(),
  userTeamId: z.string().max(120).optional(),
  settings: leagueSettingsSchema.optional(),
});

export const runnerPolicySchema = z.object({
  mode: z.enum(["copilot", "autopilot"]).optional(),
  pollIntervalMs: z.number().int().min(500).max(60000).optional(),
  safeTimeBufferSeconds: z.number().min(1).max(600).optional(),
  queue: z.array(z.string().min(1)).max(200).optional(),
  positionCaps: z.record(positionSchema, z.number().int().min(0).max(20)).optional(),
  avoidPlayerIds: z.array(z.string().min(1)).max(500).optional(),
  preferQueueOverValue: z.boolean().optional(),
});

export const startRunnerSchema = z.object({
  leagueId: z.string().min(1),
  policy: runnerPolicySchema.default({}),
  source: z.enum(["api", "page", "sandbox"]).optional(),
});

export const runnerModeSchema = z.object({
  mode: z.enum(["copilot", "autopilot"]),
  reason: z.string().max(200).default("manual"),
});

export const credentialSchema = z.discriminatedUnion("provider", [
  z.object({ provider: z.literal("sleeper"), label: z.string().max(60).default("default"), username: z.string().min(1).max(60), userId: z.string().max(60).default("") }),
  z.object({ provider: z.literal("espn"), label: z.string().max(60).default("default"), swid: z.string().min(8).max(80), espnS2: z.string().min(16).max(2000) }),
  z.object({
    provider: z.literal("yahoo"),
    label: z.string().max(60).default("oauth"),
    consumerKey: z.string().min(1).max(400),
    consumerSecret: z.string().min(1).max(400),
    accessToken: z.string().max(4000).default(""),
    refreshToken: z.string().max(4000).default(""),
    expiresAt: z.number().int().nonnegative().default(0),
  }),
]);

export const espnCookieHeaderSchema = z.object({ cookieHeader: z.string().min(10).max(5000), label: z.string().max(60).default("default") });

export const browserLaunchSchema = z.object({
  provider: providerSchema,
  targetUrl: z.string().url().or(z.literal("")).default(""),
  headless: z.boolean().default(false),
});

export const browserCookiesSchema = z.object({ sessionId: z.string().min(1), save: z.boolean().default(true) });

export const sandboxConfigSchema = z.object({
  teams: z.number().int().min(4).max(16).default(12),
  rounds: z.number().int().min(2).max(20).default(15),
  userSlot: z.number().int().min(1).max(16).default(5),
  pickTimerSeconds: z.number().int().min(5).max(600).default(60),
  botDelayMinMs: z.number().int().min(10).max(60000).default(1500),
  botDelayMaxMs: z.number().int().min(10).max(120000).default(6000),
  seed: z.number().int().default(42),
});

export const stressTestSchema = z.object({
  simulations: z.number().int().min(1).max(200).default(10),
  config: sandboxConfigSchema.default({ teams: 12, rounds: 15, userSlot: 5, pickTimerSeconds: 60, botDelayMinMs: 1500, botDelayMaxMs: 6000, seed: 42 }),
  policy: runnerPolicySchema.default({}),
});

export const liveSandboxSchema = z.object({
  config: sandboxConfigSchema.default({ teams: 12, rounds: 15, userSlot: 5, pickTimerSeconds: 60, botDelayMinMs: 1500, botDelayMaxMs: 6000, seed: 42 }),
  policy: runnerPolicySchema.default({}),
  autoStartRunner: z.boolean().default(true),
});

export const sandboxPickSchema = z.object({ playerId: z.string().min(1) });

export const yahooTokenSchema = z.object({
  consumerKey: z.string().min(1).optional(),
  consumerSecret: z.string().min(1).optional(),
  code: z.string().min(1).max(200),
  redirectUri: z.string().min(1).optional(),
});

export const yahooDomSchema = z.object({ html: z.string().min(1).max(5_000_000), leagueKey: z.string().min(1).default("yahoo-dom"), teams: z.number().int().min(2).max(20).default(10) });

export const settingsSchema = z.object({
  audioAlerts: z.boolean().optional(),
  defaultSafeBufferSeconds: z.number().min(1).max(600).optional(),
  defaultPollIntervalMs: z.number().int().min(500).max(60000).optional(),
});

export const eventsQuerySchema = z.object({
  since: z.coerce.number().int().nonnegative().default(0),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

export const espnQuerySchema = z.object({ season: z.coerce.number().int().min(2015).max(2100).default(new Date().getFullYear()) });
