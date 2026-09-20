import { sql } from "drizzle-orm";
import { db } from "../db/client.js";

export async function truncateAll(): Promise<void> {
  await db.execute(sql`TRUNCATE TABLE sites RESTART IDENTITY CASCADE`);
}
