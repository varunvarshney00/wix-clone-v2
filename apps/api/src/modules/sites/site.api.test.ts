import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../app.js";
import { closePool } from "../../db/pool.js";
import { truncateAll } from "../../test/setup.js";

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp({ logger: false });
});

beforeEach(async () => {
  await truncateAll();
});

afterAll(async () => {
  await app.close();
  await closePool();
});

describe("POST /api/v1/sites", () => {
  it("returns 201 with a location header", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/sites",
      payload: { name: "Joe's Pizza" },
    });

    expect(response.statusCode).toBe(201);

    const body = response.json();
    expect(body.slug).toBe("joes-pizza");
    expect(response.headers.location).toBe(`/api/v1/sites/${body.id}`);
  });

  it("returns only the fields in the public contract", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/sites",
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

  it("returns 409 on a duplicate slug", async () => {
    await app.inject({
      method: "POST",
      url: "/api/v1/sites",
      payload: { name: "Dupe" },
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/sites",
      payload: { name: "Dupe" },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe("CONFLICT");
  });

  it("returns 400 with field issues for an empty name", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/sites",
      payload: { name: "" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.details.issues.name).toBeDefined();
  });
});

describe("GET /api/v1/sites/:id", () => {
  it("returns 404 with NOT_FOUND for a valid but unknown uuid", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/sites/00000000-0000-0000-0000-000000000000",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe("NOT_FOUND");
  });

  it("returns 400 for a malformed uuid", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/sites/not-a-uuid",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("VALIDATION_FAILED");
  });
});

describe("GET /api/v1/sites", () => {
  it("returns an envelope with pagination metadata", async () => {
    await app.inject({
      method: "POST",
      url: "/api/v1/sites",
      payload: { name: "One" },
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/sites?limit=5",
    });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.pagination).toEqual({ limit: 5, offset: 0, count: 1 });
  });

  it("returns 400 when limit exceeds the maximum", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/sites?limit=999",
    });

    expect(response.statusCode).toBe(400);
  });
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
