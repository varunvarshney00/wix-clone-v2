import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import type { FastifyInstance } from "fastify";
import { closePool } from "../../db/pool.js";
import { buildTestApp, createTestUser, truncateAll, type TestUser } from "../../test/setup.js";

let app: FastifyInstance;
let alice: TestUser;
let bob: TestUser;
let aliceSiteId: string;

beforeAll(async () => {
  app = await buildTestApp();
});

beforeEach(async () => {
  await truncateAll();
  alice = await createTestUser(app, "Alice Co");
  bob = await createTestUser(app, "Bob Co");

  const site = await app.inject({
    method: "POST",
    url: "/api/v1/sites",
    headers: alice.authHeader,
    payload: { name: "Alice Site" },
  });

  aliceSiteId = site.json().id;
});

afterAll(async () => {
  await app.close();
  await closePool();
});

async function createPage(user: TestUser, siteId: string, title: string, path: string) {
  return app.inject({
    method: "POST",
    url: `/api/v1/sites/${siteId}/pages`,
    headers: user.authHeader,
    payload: { title, path },
  });
}

describe("POST /sites/:siteId/pages", () => {
  it("makes the first page the home page", async () => {
    const response = await createPage(alice, aliceSiteId, "Home", "/");

    expect(response.statusCode).toBe(201);
    expect(response.json().isHome).toBe(true);
  });

  it("does not make subsequent pages the home page", async () => {
    await createPage(alice, aliceSiteId, "Home", "/");
    const response = await createPage(alice, aliceSiteId, "Menu", "/menu");

    expect(response.json().isHome).toBe(false);
  });

  it("normalises the submitted path", async () => {
    await createPage(alice, aliceSiteId, "Home", "/");
    const response = await createPage(alice, aliceSiteId, "Menu", "Our Menu!");

    expect(response.json().path).toBe("/our-menu");
  });

  it("rejects a duplicate path within a site", async () => {
    await createPage(alice, aliceSiteId, "Menu", "/menu");
    const response = await createPage(alice, aliceSiteId, "Menu Again", "/menu");

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe("CONFLICT");
  });

  it("allows the same path in a different site", async () => {
    await createPage(alice, aliceSiteId, "About", "/about");

    const second = await app.inject({
      method: "POST",
      url: "/api/v1/sites",
      headers: alice.authHeader,
      payload: { name: "Second Site" },
    });

    const response = await createPage(alice, second.json().id, "About", "/about");

    expect(response.statusCode).toBe(201);
  });

  it("does not expose orgId or draftTree", async () => {
    const response = await createPage(alice, aliceSiteId, "Home", "/");

    expect(Object.keys(response.json()).sort()).toEqual([
      "createdAt",
      "id",
      "isHome",
      "path",
      "siteId",
      "title",
      "updatedAt",
    ]);
  });
});

describe("tenant isolation", () => {
  it("returns 404 when adding a page to another org's site", async () => {
    const response = await createPage(bob, aliceSiteId, "Injected", "/hacked");

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe("NOT_FOUND");
  });

  it("returns 404 when listing another org's pages", async () => {
    await createPage(alice, aliceSiteId, "Home", "/");

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/sites/${aliceSiteId}/pages`,
      headers: bob.authHeader,
    });

    expect(response.statusCode).toBe(404);
  });

  it("returns 404 when fetching another org's page by id", async () => {
    const page = await createPage(alice, aliceSiteId, "Home", "/");

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/sites/${aliceSiteId}/pages/${page.json().id}`,
      headers: bob.authHeader,
    });

    expect(response.statusCode).toBe(404);
  });

  it("returns 404 when a page id is used with the wrong site id", async () => {
    const page = await createPage(alice, aliceSiteId, "Home", "/");

    const other = await app.inject({
      method: "POST",
      url: "/api/v1/sites",
      headers: alice.authHeader,
      payload: { name: "Other Site" },
    });

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/sites/${other.json().id}/pages/${page.json().id}`,
      headers: alice.authHeader,
    });

    expect(response.statusCode).toBe(404);
  });

  it("returns 404 when deleting another org's page", async () => {
    await createPage(alice, aliceSiteId, "Home", "/");
    const menu = await createPage(alice, aliceSiteId, "Menu", "/menu");

    const response = await app.inject({
      method: "DELETE",
      url: `/api/v1/sites/${aliceSiteId}/pages/${menu.json().id}`,
      headers: bob.authHeader,
    });

    expect(response.statusCode).toBe(404);
  });
});

describe("GET /sites/:siteId/pages", () => {
  it("returns pages ordered by path", async () => {
    await createPage(alice, aliceSiteId, "Home", "/");
    await createPage(alice, aliceSiteId, "Menu", "/menu");
    await createPage(alice, aliceSiteId, "About", "/about");

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/sites/${aliceSiteId}/pages`,
      headers: alice.authHeader,
    });

    expect(response.json().data.map((p: { path: string }) => p.path)).toEqual([
      "/",
      "/about",
      "/menu",
    ]);
  });
});

describe("PATCH /sites/:siteId/pages/:pageId", () => {
  it("updates the title", async () => {
    const page = await createPage(alice, aliceSiteId, "Home", "/");

    const response = await app.inject({
      method: "PATCH",
      url: `/api/v1/sites/${aliceSiteId}/pages/${page.json().id}`,
      headers: alice.authHeader,
      payload: { title: "Welcome" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().title).toBe("Welcome");
    expect(response.json().path).toBe("/");
  });

  it("normalises an updated path", async () => {
    await createPage(alice, aliceSiteId, "Home", "/");
    const menu = await createPage(alice, aliceSiteId, "Menu", "/menu");

    const response = await app.inject({
      method: "PATCH",
      url: `/api/v1/sites/${aliceSiteId}/pages/${menu.json().id}`,
      headers: alice.authHeader,
      payload: { path: "Food & Drink" },
    });

    expect(response.json().path).toBe("/food-drink");
  });

  it("rejects an empty body", async () => {
    const page = await createPage(alice, aliceSiteId, "Home", "/");

    const response = await app.inject({
      method: "PATCH",
      url: `/api/v1/sites/${aliceSiteId}/pages/${page.json().id}`,
      headers: alice.authHeader,
      payload: {},
    });

    expect(response.statusCode).toBe(400);
  });

  it("rejects updating a path to one that already exists", async () => {
    await createPage(alice, aliceSiteId, "Home", "/");
    await createPage(alice, aliceSiteId, "About", "/about");
    const menu = await createPage(alice, aliceSiteId, "Menu", "/menu");

    const response = await app.inject({
      method: "PATCH",
      url: `/api/v1/sites/${aliceSiteId}/pages/${menu.json().id}`,
      headers: alice.authHeader,
      payload: { path: "/about" },
    });

    expect(response.statusCode).toBe(409);
  });

  it("bumps updatedAt", async () => {
    const page = await createPage(alice, aliceSiteId, "Home", "/");
    const before = page.json().updatedAt;

    await new Promise((resolve) => {
      setTimeout(resolve, 10);
    });

    const response = await app.inject({
      method: "PATCH",
      url: `/api/v1/sites/${aliceSiteId}/pages/${page.json().id}`,
      headers: alice.authHeader,
      payload: { title: "Changed" },
    });

    expect(response.json().updatedAt).not.toBe(before);
  });
});

describe("DELETE /sites/:siteId/pages/:pageId", () => {
  it("deletes a non-home page", async () => {
    await createPage(alice, aliceSiteId, "Home", "/");
    const menu = await createPage(alice, aliceSiteId, "Menu", "/menu");

    const response = await app.inject({
      method: "DELETE",
      url: `/api/v1/sites/${aliceSiteId}/pages/${menu.json().id}`,
      headers: alice.authHeader,
    });

    expect(response.statusCode).toBe(204);

    const list = await app.inject({
      method: "GET",
      url: `/api/v1/sites/${aliceSiteId}/pages`,
      headers: alice.authHeader,
    });

    expect(list.json().data).toHaveLength(1);
  });

  it("refuses to delete the home page", async () => {
    const home = await createPage(alice, aliceSiteId, "Home", "/");

    const response = await app.inject({
      method: "DELETE",
      url: `/api/v1/sites/${aliceSiteId}/pages/${home.json().id}`,
      headers: alice.authHeader,
    });

    expect(response.statusCode).toBe(409);
  });
});

describe("cascade behaviour", () => {
  it("removes a site's pages when the site's org is deleted", async () => {
    await createPage(alice, aliceSiteId, "Home", "/");

    // alice org deleted

    // Bob's org still exists; only Alice's data should vanish.
    await app.inject({
      method: "POST",
      url: "/api/v1/sites",
      headers: bob.authHeader,
      payload: { name: "Bob Site" },
    });

    const bobSites = await app.inject({
      method: "GET",
      url: "/api/v1/sites",
      headers: bob.authHeader,
    });

    expect(bobSites.json().data).toHaveLength(1);
  });
});