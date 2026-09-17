import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";

export const sites = pgTable(
  "sites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("sites_created_at_idx").on(table.createdAt)],
);

export type Site = typeof sites.$inferSelect;
export type NewSite = typeof sites.$inferInsert;