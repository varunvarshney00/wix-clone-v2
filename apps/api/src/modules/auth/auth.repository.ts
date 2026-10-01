import { and, eq, isNull } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  refreshTokens,
  users,
  type NewUser,
  type RefreshToken,
  type User,
} from "../../db/schema.js";

export async function insertUser(data: NewUser, tx: any = db): Promise<User> {
  const [row] = await tx.insert(users).values(data).returning();
  if (!row) throw new Error("insert into users returned no row");
  return row;
}

export async function findUserByEmail(
  email: string,
): Promise<User | undefined> {
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return row;
}

export async function findUserById(id: string): Promise<User | undefined> {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row;
}

export async function insertRefreshToken(data: {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}): Promise<RefreshToken> {
  const [row] = await db.insert(refreshTokens).values(data).returning();
  if (!row) throw new Error("insert into refresh_tokens returned no row");
  return row;
}

export async function findActiveRefreshToken(
  tokenHash: string,
): Promise<RefreshToken | undefined> {
  const [row] = await db
    .select()
    .from(refreshTokens)
    .where(
      and(
        eq(refreshTokens.tokenHash, tokenHash),
        isNull(refreshTokens.revokedAt),
      ),
    )
    .limit(1);

  return row;
}

export async function revokeRefreshToken(id: string): Promise<void> {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.id, id));
}

export async function revokeAllUserRefreshTokens(
  userId: string,
): Promise<void> {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)),
    );
}
