import { z } from "zod";

const booleanFromEnv = z.preprocess((value) => {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return value;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  // Invalid values must fail validation, not silently enable live sending.
  return value;
}, z.boolean());

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().optional(),
  SESSION_SECRET: z.string().min(32).default("researchreach-dev-session-secret-change-me"),
  TOKEN_ENCRYPTION_KEY: z.string().min(16).default("researchreach-dev-token-key-change"),
  MICROSOFT_CLIENT_ID: z.string().optional().default(""),
  MICROSOFT_CLIENT_SECRET: z.string().optional().default(""),
  MICROSOFT_TENANT_ID: z.string().default("common"),
  MICROSOFT_REDIRECT_URI: z
    .string()
    .default("http://localhost:3000/api/auth/microsoft/callback"),
  LLM_API_KEY: z.string().optional().default(""),
  LLM_MODEL: z.string().default("gpt-4o-mini"),
  LLM_BASE_URL: z.string().default("https://api.openai.com/v1"),
  SEARCH_PROVIDER: z.string().default("tavily"),
  SEARCH_API_KEY: z.string().optional().default(""),
  SEARCH_API_URL: z.string().optional().default(""),
  RESUME_PATH: z.string().default("data/resume.pdf"),
  MAX_EMAILS_PER_DAY: z.coerce.number().int().positive().default(15),
  PROFESSOR_COOLDOWN_DAYS: z.coerce.number().int().positive().default(90),
  MIN_RELEVANCE_SCORE: z.coerce.number().int().min(0).max(100).default(65),
  AUTOPILOT_MIN_SCORE: z.coerce.number().int().min(0).max(100).default(80),
  AUTO_SEND: booleanFromEnv.default(false),
  GUESS_EMAILS: booleanFromEnv.default(false),
  DRY_RUN: booleanFromEnv.default(true),
  PLAYWRIGHT_ENABLED: booleanFromEnv.default(false),
  CRAWL_DELAY_MS: z.coerce.number().int().nonnegative().default(1000),
  APP_ACCESS_SECRET: z.string().optional().default(""),
  EMAIL_PROVIDER: z.enum(["gmail"]).default("gmail"),
  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(""),
  GOOGLE_REDIRECT_URI: z.string().default("http://localhost:3000/api/auth/google/callback"),
  GOOGLE_ALLOWED_EMAIL: z.string().email().default("saket.amanana@gmail.com"),
  NODE_ENV: z.string().optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

let cached: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (cached) return cached;
  cached = envSchema.parse(process.env);
  return cached;
}

export function resetEnvCache() {
  cached = null;
}

export function isLlmConfigured() {
  return Boolean(getEnv().LLM_API_KEY);
}

export function isSearchApiConfigured() {
  return Boolean(getEnv().SEARCH_API_KEY);
}

export function isGoogleConfigured() {
  const env = getEnv();
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

export function isMicrosoftConfigured() {
  const env = getEnv();
  return Boolean(env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET);
}
