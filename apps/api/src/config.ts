import { z } from "zod";
import { resolve } from "node:path";

try {
  process.loadEnvFile(resolve(import.meta.dirname, "../../../.env"));
} catch {
    
}

const configSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().min(1).default("127.0.0.1"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  DATABASE_URL: z.string().min(1),
  TEST_DATABASE_URL: z.string().min(1).optional(),
  JWT_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).default(30),
});

const parsed = configSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:");
  console.error(z.prettifyError(parsed.error));
  process.exit(1);
}

const databaseUrl =
  parsed.data.NODE_ENV === "test" ? parsed.data.TEST_DATABASE_URL : parsed.data.DATABASE_URL;

if (!databaseUrl) {
  console.error("TEST_DATABASE_URL is required when NODE_ENV=test");
  process.exit(1);
}

export const config = {
  nodeEnv: parsed.data.NODE_ENV,
  port: parsed.data.PORT,
  host: parsed.data.HOST,
  logLevel: parsed.data.LOG_LEVEL,
  databaseUrl,
  isProduction: parsed.data.NODE_ENV === "production",
  jwtSecret: parsed.data.JWT_SECRET,
  accessTokenTtl: parsed.data.ACCESS_TOKEN_TTL,
  refreshTokenTtlDays: parsed.data.REFRESH_TOKEN_TTL_DAYS,
} as const;