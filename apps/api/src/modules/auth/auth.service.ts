import { ConflictError, UnauthorizedError } from "../../shared/errors.js";
import type { Organization, User } from "../../db/schema.js";
import { isUniqueViolation } from "../../shared/errors.js";
import { hashPassword, verifyPassword } from "./password.js";
import * as repository from "./auth.repository.js";
import {
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenExpiry,
  signAccessToken,
} from "./tokens.js";

import { db } from "../../db/client.js";
import * as orgRepository from "../orgs/org.repository.js";
import { slugify } from "../sites/slug.js";
import { randomBytes } from "node:crypto";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface RegisterResult extends TokenPair {
  user: User;
  organization: Organization;
}

export interface AuthResult extends TokenPair {
  user: User;
}

function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function issueTokens(userId: string): Promise<TokenPair> {
  const refreshToken = generateRefreshToken();

  await repository.insertRefreshToken({
    userId,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt: refreshTokenExpiry(),
  });

  return { accessToken: signAccessToken(userId), refreshToken };
}

export async function register(input: {
  email: string;
  password: string;
  organizationName?: string;
}): Promise<RegisterResult> {
  const email = normaliseEmail(input.email);
  const passwordHash = await hashPassword(input.password);

  const orgName = input.organizationName?.trim() || `${email.split("@")[0]}'s workspace`;

  const baseSlug = slugify(orgName) || "workspace";
  const orgSlug = `${baseSlug}-${randomBytes(4).toString("hex")}`;

  let created: { user: User; organization: Organization };

  try {
    created = await db.transaction(async (tx) => {

      const user = await repository.insertUser({ email, passwordHash }, tx);

      const organization = await orgRepository.insertOrganization(
        { name: orgName, slug: orgSlug },
        tx,
      );
      
      await orgRepository.insertMembership(
        { userId: user.id, orgId: organization.id, role: "owner" },
        tx,
      );

      return { user, organization };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError("an account with this email already exists", { email });
    }
    throw error;
  }

  const tokens = await issueTokens(created.user.id);
  return { ...created, ...tokens };
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<AuthResult> {
  const email = normaliseEmail(input.email);
  const user = await repository.findUserByEmail(email);

  // Hash a dummy value when the user is absent so the response time
  // does not reveal whether the email is registered.
  const storedHash =
    user?.passwordHash ?? (await hashPassword("timing-equaliser"));
  const valid = await verifyPassword(storedHash, input.password);

  if (!user || !valid) {
    throw new UnauthorizedError("invalid email or password");
  }

  const tokens = await issueTokens(user.id);
  return { user, ...tokens };
}

export async function refresh(presentedToken: string): Promise<TokenPair> {
  const tokenHash = hashRefreshToken(presentedToken);
  const stored = await repository.findActiveRefreshToken(tokenHash);

  if (!stored) {
    throw new UnauthorizedError("invalid refresh token");
  }

  if (stored.expiresAt.getTime() <= Date.now()) {
    await repository.revokeRefreshToken(stored.id);
    throw new UnauthorizedError("refresh token expired");
  }

  // Rotation: the presented token is consumed, a new one issued.
  await repository.revokeRefreshToken(stored.id);
  return issueTokens(stored.userId);
}

export async function logout(presentedToken: string): Promise<void> {
  const stored = await repository.findActiveRefreshToken(
    hashRefreshToken(presentedToken),
  );
  if (stored) {
    await repository.revokeRefreshToken(stored.id);
  }
}

export async function getUserById(id: string): Promise<User | undefined> {
  return repository.findUserById(id);
}
