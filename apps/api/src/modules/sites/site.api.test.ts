import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import type { FastifyInstance } from "fastify";
import { closePool } from "../../db/pool.js";
import { buildTestApp, createTestUser, truncateAll, type TestUser } from "../../test/setup.js";


let app: FastifyInstance;
let alice: TestUser;
let bob: TestUser;

beforeAll(async () => {
  app = await buildTestApp();
});

beforeEach(async () => {
  await truncateAll();
  alice = await createTestUser(app, "Alice Co");
  bob = await createTestUser(app, "Bob Co");
});

afterAll(async () => {
  await app.close();
  await closePool();
});

describe("unknown routes", () => {
  it("returns ROUTE_NOT_FOUND in the standard envelope", async () => {
    const response = await app.inject({ method: "GET", url: "/api/v1/nope" });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe("ROUTE_NOT_FOUND");
  });
});

describe("GET /health", () => {
  it("returns ok", async () => {
    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });
});

async function createSite(user: TestUser, name: string) {
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/sites",
    headers: user.authHeader,
    payload: { name },
  });

  return response.json();
}

describe("authentication is required", () => {
  it("rejects requests with no token", async () => {
    const response = await app.inject({ method: "GET", url: "/api/v1/sites" });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe("UNAUTHORIZED");
  });

  it("rejects a tampered token", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/sites",
      headers: { authorization: `${alice.authHeader.authorization}X` },
    });

    expect(response.statusCode).toBe(401);
  });
});

describe("tenant isolation", () => {
  it("does not return another org's site by id", async () => {
    const aliceSite = await createSite(alice, "Alice Site");

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/sites/${aliceSite.id}`,
      headers: bob.authHeader,
    });

    // 404, not 403 — the response must not confirm the site exists.
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe("NOT_FOUND");
  });

  it("does not list another org's sites", async () => {
    await createSite(alice, "Alice One");
    await createSite(alice, "Alice Two");
    await createSite(bob, "Bob One");

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/sites",
      headers: bob.authHeader,
    });

    const body = response.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].slug).toBe("bob-one");
  });

  it("rejects a forged X-Org-Id header", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/sites",
      headers: { ...bob.authHeader, "x-org-id": alice.orgId },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("FORBIDDEN");
  });

  it("allows the same slug in different orgs", async () => {
    await createSite(alice, "My Restaurant");

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/sites",
      headers: bob.authHeader,
      payload: { name: "My Restaurant" },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().slug).toBe("my-restaurant");
  });

  it("still rejects a duplicate slug within one org", async () => {
    await createSite(alice, "My Restaurant");

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/sites",
      headers: alice.authHeader,
      payload: { name: "My Restaurant" },
    });

    expect(response.statusCode).toBe(409);
  });
});

describe("response contract", () => {
  it("never exposes orgId", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/sites",
      headers: alice.authHeader,
      payload: { name: "Contract Check" },
    });

    expect(Object.keys(response.json()).sort()).toEqual([
      "createdAt",
      "id",
      "name",
      "slug",
      "updatedAt",
    ]);
  });
});

describe("validation", () => {
  it("returns 400 with field issues for an empty name", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/sites",
      headers: alice.authHeader,
      payload: { name: "" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.details.issues.name).toBeDefined();
  });

  it("returns 400 for a malformed uuid", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/sites/not-a-uuid",
      headers: alice.authHeader,
    });

    expect(response.statusCode).toBe(400);
  });

  it("returns 400 when limit exceeds the maximum", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/sites?limit=999",
      headers: alice.authHeader,
    });

    expect(response.statusCode).toBe(400);
  });
});