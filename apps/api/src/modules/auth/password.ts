import { hash, verify } from "@node-rs/argon2";

// OWASP-recommended baseline for Argon2id.
const OPTIONS = {
  memoryCost: 19_456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(plaintext: string): Promise<string> {
  return hash(plaintext, OPTIONS);
}

export async function verifyPassword(
  storedHash: string,
  plaintext: string,
): Promise<boolean> {
  try {
    return await verify(storedHash, plaintext, OPTIONS);
  } catch {
    // A malformed hash in the database must not crash a login attempt.
    return false;
  }
}
