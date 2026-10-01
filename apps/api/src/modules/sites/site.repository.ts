import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { sites, type Site } from "../../db/schema.js";

export async function insertSite(data: {
  orgId: string;
  name: string;
  slug: string;
}): Promise<Site> {
  const [row] = await db.insert(sites).values(data).returning();
  if (!row) throw new Error("insert into sites returned no row");
  return row;
}

export async function findSiteById(orgId: string, id: string): Promise<Site | undefined> {
  const [row] = await db
    .select()
    .from(sites)
    .where(and(eq(sites.orgId, orgId), eq(sites.id, id)))
    .limit(1);

  return row;
}

export async function findSiteBySlug(slug: string): Promise<Site | undefined> {
  const [row] = await db.select().from(sites).where(eq(sites.slug, slug)).limit(1);
  return row;
}

export async function listSites(orgId: string, limit: number, offset: number): Promise<Site[]> {
  return db
    .select()
    .from(sites)
    .where(eq(sites.orgId, orgId))
    .orderBy(desc(sites.createdAt))
    .limit(limit)
    .offset(offset);
}