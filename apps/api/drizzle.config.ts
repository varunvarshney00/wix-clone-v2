import { resolve } from "node:path";
import { defineConfig } from "drizzle-kit";

try {
  process.loadEnvFile(resolve(process.cwd(), "../../.env"));
} catch {
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run migrations");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: databaseUrl },
});