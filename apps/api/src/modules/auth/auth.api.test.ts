import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import type { FastifyInstance } from "fastify";
import { closePool } from "../../db/pool.js";
import { buildTestApp, createTestUser, truncateAll } from "../../test/setup.js";

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildTestApp();
});

beforeEach(async () => {
  await truncateAll();
});

afterAll(async () => {
  await app.close();
  await closePool();
});

const validBody = {
  email: "new@example.com",
  password: "a-long-enough-password",
  organizationName: "New Co",
};

describe("POST /auth/register", () => {
  it("creates a user, an org, and an owner membership", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: validBody,
    });

    expect(response.statusCode).toBe(201);

    const body = response.json();
    expect(body.user.email).toBe("new@example.com");
    expect(body.organization.name).toBe("New Co");
    expect(body.accessToken).toBeTruthy();
    expect(body.refreshToken).toBeTruthy();
  });

  it("never returns the password hash", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: validBody,
    });

    expect(Object.keys(response.json().user).sort()).toEqual(["createdAt", "email", "id"]);
    expect(response.body).not.toContain("argon2");
  });

  it("normalises the email to lowercase", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { ...validBody, email: "MiXeD@Example.COM" },
    });

    expect(response.json().user.email).toBe("mixed@example.com");
  });

  it("rejects a duplicate email regardless of case", async () => {
    await app.inject({ method: "POST", url: "/api/v1/auth/register", payload: validBody });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { ...validBody, email: "NEW@EXAMPLE.COM" },
    });

    expect(response.statusCode).toBe(409);
  });

  it("rejects a password shorter than 12 characters", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { ...validBody, password: "short" },
    });

    expect(response.statusCode).toBe(400);
  });
});

describe("POST /auth/login", () => {
  it("returns tokens for correct credentials", async () => {
    await app.inject({ method: "POST", url: "/api/v1/auth/register", payload: validBody });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: validBody.email, password: validBody.password },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().accessToken).toBeTruthy();
  });

  it("gives the same error for a wrong password and an unknown email", async () => {
    await app.inject({ method: "POST", url: "/api/v1/auth/register", payload: validBody });

    const wrongPassword = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: validBody.email, password: "definitely-not-it" },
    });

    const unknownEmail = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "nobody@example.com", password: validBody.password },
    });

    expect(wrongPassword.statusCode).toBe(401);
    expect(unknownEmail.statusCode).toBe(401);
    expect(wrongPassword.json().error.message).toBe(unknownEmail.json().error.message);
  });
});

describe("POST /auth/refresh", () => {
  it("exchanges a refresh token for a new pair", async () => {
    const user = await createTestUser(app);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      payload: { refreshToken: user.refreshToken },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().refreshToken).not.toBe(user.refreshToken);
  });

  it("rejects a refresh token that has already been used", async () => {
    const user = await createTestUser(app);

    await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      payload: { refreshToken: user.refreshToken },
    });

    const reuse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      payload: { refreshToken: user.refreshToken },
    });

    expect(reuse.statusCode).toBe(401);
  });

  it("rejects an unknown refresh token", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      payload: { refreshToken: "not-a-real-token" },
    });

    expect(response.statusCode).toBe(401);
  });
});

describe("POST /auth/logout", () => {
  it("invalidates the refresh token", async () => {
    const user = await createTestUser(app);

    const logout = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      payload: { refreshToken: user.refreshToken },
    });

    expect(logout.statusCode).toBe(204);

    const refresh = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      payload: { refreshToken: user.refreshToken },
    });

    expect(refresh.statusCode).toBe(401);
  });
});

describe("GET /auth/me", () => {
  it("returns the caller's identity, org and role", async () => {
    const user = await createTestUser(app);

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: user.authHeader,
    });

    const body = response.json();
    expect(body.id).toBe(user.userId);
    expect(body.orgId).toBe(user.orgId);
    expect(body.role).toBe("owner");
  });

  it("returns 401 without a token", async () => {
    const response = await app.inject({ method: "GET", url: "/api/v1/auth/me" });

    expect(response.statusCode).toBe(401);
  });
});