import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "./password.js";

describe("password hashing", () => {
  it("verifies a correct password", async () => {
    const stored = await hashPassword("correct horse battery staple");
    expect(await verifyPassword(stored, "correct horse battery staple")).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const stored = await hashPassword("correct horse battery staple");
    expect(await verifyPassword(stored, "wrong password")).toBe(false);
  });

  it("produces a different hash for the same password each time", async () => {
    const a = await hashPassword("same password");
    const b = await hashPassword("same password");

    expect(a).not.toBe(b);
    expect(await verifyPassword(a, "same password")).toBe(true);
    expect(await verifyPassword(b, "same password")).toBe(true);
  });

  it("returns false rather than throwing for a malformed hash", async () => {
    expect(await verifyPassword("not-a-valid-hash", "anything")).toBe(false);
  });

  it("embeds the algorithm and parameters in the hash", async () => {
    const stored = await hashPassword("whatever");
    expect(stored).toMatch(/^\$argon2id\$/);
  });
});