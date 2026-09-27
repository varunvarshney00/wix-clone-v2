import { ConflictError, UnauthorizedError } from "../../shared/errors.js";
import type { User } from "../../db/schema.js";
import { isUniqueViolation } from "../../shared/errors.js";
import { hashPassword, verifyPassword } from "./password.js";
import * as repository from "./auth.repository.js";
import {
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenExpiry,
  signAccessToken,
} from "./tokens.js";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
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
}): Promise<AuthResult> {
  const email = normaliseEmail(input.email);
  const passwordHash = await hashPassword(input.password);

  let user: User;
  
  try {
    user = await repository.insertUser({ email, passwordHash });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError("an account with this email already exists", {
        email,
      });
    }
    throw error;
  }

  const tokens = await issueTokens(user.id);
  return { user, ...tokens };
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
