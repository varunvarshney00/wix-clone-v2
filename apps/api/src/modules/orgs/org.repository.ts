import { and, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  memberships,
  organizations,
  type MemberRole,
  type Membership,
  type Organization,
} from "../../db/schema.js";

export async function insertOrganization(
  data: { name: string; slug: string },
  tx: any = db,
): Promise<Organization> {
  const [row] = await tx.insert(organizations).values(data).returning();
  if (!row) throw new Error("insert into organizations returned no row");
  return row;
}

export async function insertMembership(
  data: { userId: string; orgId: string; role: MemberRole },
  tx: any = db,
): Promise<Membership> {
  const [row] = await tx.insert(memberships).values(data).returning();
  if (!row) throw new Error("insert into memberships returned no row");
  return row;
}

export async function findMembership(
  userId: string,
  orgId: string,
): Promise<Membership | undefined> {
  const [row] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.userId, userId), eq(memberships.orgId, orgId)))
    .limit(1);

  return row;
}

export async function findFirstMembershipForUser(userId: string): Promise<Membership | undefined> {
  const [row] = await db
    .select()
    .from(memberships)
    .where(eq(memberships.userId, userId))
    .limit(1);

  return row;
}

export async function findOrganizationById(id: string): Promise<Organization | undefined> {
  const [row] = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
  return row;
}