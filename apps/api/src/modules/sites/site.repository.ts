import { desc, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { sites, type NewSite, type Site } from "../../db/schema.js";

export async function insertSite(data: NewSite): Promise<Site> {
  const [row] = await db.insert(sites).values(data).returning();

  if (!row) {
    throw new Error("insert into sites returned no row");
  }

  return row;
}

export async function findSiteById(id: string): Promise<Site | undefined> {
  const [row] = await db.select().from(sites).where(eq(sites.id, id)).limit(1);
  return row;
}

export async function findSiteBySlug(slug: string): Promise<Site | undefined> {
  const [row] = await db.select().from(sites).where(eq(sites.slug, slug)).limit(1);
  return row;
}

export async function listSites(limit: number, offset: number): Promise<Site[]> {
  return db.select().from(sites).orderBy(desc(sites.createdAt)).limit(limit).offset(offset);
}