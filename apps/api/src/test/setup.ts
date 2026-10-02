import { sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { buildApp } from "../app.js";
import type { FastifyInstance } from "fastify";

export async function truncateAll(): Promise<void> {
  await db.execute(
    sql`TRUNCATE TABLE sites, memberships, refresh_tokens, organizations, users RESTART IDENTITY CASCADE`,
  );
}

export interface TestUser {
  email: string;
  userId: string;
  orgId: string;
  accessToken: string;
  refreshToken: string;
  authHeader: { authorization: string };
}

let counter = 0;

export async function createTestUser(app: FastifyInstance, orgName?: string): Promise<TestUser> {
  counter += 1;
  const email = `user${counter}-${Date.now()}@example.com`;

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/auth/register",
    payload: {
      email,
      password: "a-long-enough-password",
      organizationName: orgName ?? `Org ${counter}`,
    },
  });

  if (response.statusCode !== 201) {
    throw new Error(`test user registration failed: ${response.body}`);
  }

  const body = response.json();

  return {
    email,
    userId: body.user.id,
    orgId: body.organization.id,
    accessToken: body.accessToken,
    refreshToken: body.refreshToken,
    authHeader: { authorization: `Bearer ${body.accessToken}` },
  };
}

export async function buildTestApp(): Promise<FastifyInstance> {
  return buildApp({ logger: false });
}