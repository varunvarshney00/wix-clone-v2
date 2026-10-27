import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import type { FastifyInstance } from "fastify";
import { SCHEMA_VERSION } from "@wix-clone/shared";
import { closePool } from "../../db/pool.js";
import {
  buildTestApp,
  createTestUser,
  truncateAll,
  type TestUser,
} from "../../test/setup.js";

let app: FastifyInstance;
let alice: TestUser;
let bob: TestUser;
let siteId: string;
let pageId: string;

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
  siteId = site.json().id;

  const page = await app.inject({
    method: "POST",
    url: `/api/v1/sites/${siteId}/pages`,
    headers: alice.authHeader,
    payload: { title: "Home", path: "/" },
  });
  pageId = page.json().id;
});

afterAll(async () => {
  await app.close();
  await closePool();
});

function treeUrl(site = siteId, page = pageId): string {
  return `/api/v1/sites/${site}/pages/${page}/tree`;
}

function heroTree(headingText: string) {
  return {
    schemaVersion: SCHEMA_VERSION,
    sections: [
      {
        id: "sec00001",
        type: "hero",
        props: {},
        children: [
          { id: "hed00001", type: "heading", props: { text: headingText } },
        ],
      },
    ],
  };
}

async function save(
  user: TestUser,
  version: number,
  tree: unknown,
  url = treeUrl(),
) {
  return app.inject({
    method: "PUT",
    url,
    headers: user.authHeader,
    payload: { version, tree },
  });
}

describe("GET tree", () => {
  it("returns an empty tree at version 1 for a new page", async () => {
    const response = await app.inject({
      method: "GET",
      url: treeUrl(),
      headers: alice.authHeader,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      version: 1,
      tree: { schemaVersion: SCHEMA_VERSION, sections: [] },
    });
  });
});

describe("PUT tree", () => {
  it("saves a tree and increments the version", async () => {
    const response = await save(alice, 1, heroTree("Joe's Pizza"));

    expect(response.statusCode).toBe(200);
    expect(response.json().version).toBe(2);
  });

  it("persists the tree so a later read returns it", async () => {
    await save(alice, 1, heroTree("Joe's Pizza"));

    const read = await app.inject({
      method: "GET",
      url: treeUrl(),
      headers: alice.authHeader,
    });
    const heading = read.json().tree.sections[0].children[0];

    expect(heading.props.text).toBe("Joe's Pizza");
  });

  it("fills in omitted props with their defaults", async () => {
    const response = await save(alice, 1, heroTree("Defaults"));
    const heading = response.json().tree.sections[0].children[0];

    expect(heading.props).toMatchObject({
      level: 2,
      tone: "default",
      align: "start",
    });
  });

  it("increments the version on each successive save", async () => {
    const first = await save(alice, 1, heroTree("One"));
    const second = await save(alice, first.json().version, heroTree("Two"));
    const third = await save(alice, second.json().version, heroTree("Three"));

    expect([first, second, third].map((r) => r.json().version)).toEqual([
      2, 3, 4,
    ]);
  });
});

describe("optimistic concurrency", () => {
  it("rejects a save based on a stale version", async () => {
    await save(alice, 1, heroTree("First writer"));

    const stale = await save(alice, 1, heroTree("Second writer"));

    expect(stale.statusCode).toBe(409);
    expect(stale.json().error.code).toBe("CONFLICT");
  });

  it("reports both the stale and the current version", async () => {
    await save(alice, 1, heroTree("First"));

    const stale = await save(alice, 1, heroTree("Second"));

    expect(stale.json().error.details).toMatchObject({ yourVersion: 1, currentVersion: 2 });
  });

  it("leaves the first writer's content intact after a rejected save", async () => {
    await save(alice, 1, heroTree("Kept"));
    await save(alice, 1, heroTree("Discarded"));

    const read = await app.inject({ method: "GET", url: treeUrl(), headers: alice.authHeader });

    expect(read.json().tree.sections[0].children[0].props.text).toBe("Kept");
    expect(read.json().version).toBe(2);
  });

  it("allows the second writer to succeed after refetching the version", async () => {
    await save(alice, 1, heroTree("First"));

    const read = await app.inject({ method: "GET", url: treeUrl(), headers: alice.authHeader });
    const retry = await save(alice, read.json().version, heroTree("Second"));

    expect(retry.statusCode).toBe(200);
    expect(retry.json().version).toBe(3);
  });

  it("only one of two concurrent saves at the same version succeeds", async () => {
    const [a, b] = await Promise.all([
      save(alice, 1, heroTree("Racer A")),
      save(alice, 1, heroTree("Racer B")),
    ]);

    const statuses = [a.statusCode, b.statusCode].sort();
    expect(statuses).toEqual([200, 409]);
  });
});

describe("tree validation", () => {
  it("rejects an unknown component type", async () => {
    const response = await save(alice, 1, {
      schemaVersion: SCHEMA_VERSION,
      sections: [
        {
          id: "sec00001",
          type: "hero",
          props: {},
          children: [{ id: "vid00001", type: "video", props: {} }],
        },
      ],
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("VALIDATION_FAILED");
  });

  it("rejects a javascript: href", async () => {
    const response = await save(alice, 1, {
      schemaVersion: SCHEMA_VERSION,
      sections: [
        {
          id: "sec00001",
          type: "hero",
          props: {},
          children: [
            {
              id: "btn00001",
              type: "button",
              props: { label: "Click", href: "javascript:alert(1)" },
            },
          ],
        },
      ],
    });

    expect(response.statusCode).toBe(400);
  });

  it("rejects a mismatched schemaVersion", async () => {
    const response = await save(alice, 1, { schemaVersion: 99, sections: [] });

    expect(response.statusCode).toBe(400);
  });

  it("does not increment the version when validation fails", async () => {
    await save(alice, 1, { schemaVersion: 99, sections: [] });

    const read = await app.inject({ method: "GET", url: treeUrl(), headers: alice.authHeader });

    expect(read.json().version).toBe(1);
  });

  it("stores script content verbatim rather than stripping it", async () => {
    const payload = "<script>alert(1)</script>";

    await save(alice, 1, {
      schemaVersion: SCHEMA_VERSION,
      sections: [
        {
          id: "sec00001",
          type: "hero",
          props: {},
          children: [{ id: "txt00001", type: "text", props: { content: payload } }],
        },
      ],
    });

    const read = await app.inject({ method: "GET", url: treeUrl(), headers: alice.authHeader });

    expect(read.json().tree.sections[0].children[0].props.content).toBe(payload);
  });
});

describe("tenant isolation", () => {
  it("returns 404 when reading another org's page tree", async () => {
    const response = await app.inject({ method: "GET", url: treeUrl(), headers: bob.authHeader });

    expect(response.statusCode).toBe(404);
  });

  it("returns 404 when writing another org's page tree", async () => {
    const response = await save(bob, 1, heroTree("Injected"));

    expect(response.statusCode).toBe(404);
  });

  it("returns 404 for a page id paired with the wrong site id", async () => {
    const other = await app.inject({
      method: "POST",
      url: "/api/v1/sites",
      headers: alice.authHeader,
      payload: { name: "Other Site" },
    });

    const response = await app.inject({
      method: "GET",
      url: treeUrl(other.json().id, pageId),
      headers: alice.authHeader,
    });

    expect(response.statusCode).toBe(404);
  });
});

describe("authorization", () => {
  it("requires authentication", async () => {
    const response = await app.inject({ method: "GET", url: treeUrl() });

    expect(response.statusCode).toBe(401);
  });
});