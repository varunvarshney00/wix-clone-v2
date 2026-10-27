import { and, asc, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { pages, type Page } from "../../db/schema.js";

import { sql } from "drizzle-orm";
import type { PageTree } from "@wix-clone/shared";

export async function insertPage(
  data: {
    orgId: string;
    siteId: string;
    title: string;
    path: string;
    isHome?: boolean;
  },
  tx: typeof db = db,
): Promise<Page> {
  const [row] = await tx.insert(pages).values(data).returning();
  if (!row) throw new Error("insert into pages returned no row");
  return row;
}

export async function findPageById(
  orgId: string,
  siteId: string,
  id: string,
): Promise<Page | undefined> {
  const [row] = await db
    .select()
    .from(pages)
    .where(and(eq(pages.orgId, orgId), eq(pages.siteId, siteId), eq(pages.id, id)))
    .limit(1);

  return row;
}

export async function listPagesBySite(orgId: string, siteId: string): Promise<Page[]> {
  return db
    .select()
    .from(pages)
    .where(and(eq(pages.orgId, orgId), eq(pages.siteId, siteId)))
    .orderBy(asc(pages.path));
}

export async function updatePage(
  orgId: string,
  siteId: string,
  id: string,
  data: { title?: string; path?: string },
): Promise<Page | undefined> {
  const [row] = await db
    .update(pages)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(pages.orgId, orgId), eq(pages.siteId, siteId), eq(pages.id, id)))
    .returning();

  return row;
}

export async function deletePage(
  orgId: string,
  siteId: string,
  id: string,
): Promise<Page | undefined> {
  const [row] = await db
    .delete(pages)
    .where(and(eq(pages.orgId, orgId), eq(pages.siteId, siteId), eq(pages.id, id)))
    .returning();

  return row;
}

export async function updatePageTree(
  orgId: string,
  siteId: string,
  id: string,
  tree: PageTree,
  expectedVersion: number,
): Promise<Page | undefined> {
  const [row] = await db
    .update(pages)
    .set({
      draftTree: tree,
      version: sql`${pages.version} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(pages.orgId, orgId),
        eq(pages.siteId, siteId),
        eq(pages.id, id),
        eq(pages.version, expectedVersion),
      ),
    )
    .returning();

  return row;
}