import { createHash, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import { config } from "../../config.js";

export interface AccessTokenPayload {
  sub: string;
}

export function signAccessToken(userId: string): string {
  return jwt.sign({ sub: userId }, config.jwtSecret, {
    expiresIn: config.accessTokenTtl,
    algorithm: "HS256",
  } as jwt.SignOptions);
}

export function verifyAccessToken(
  token: string,
): AccessTokenPayload | undefined {
  try {
    const decoded = jwt.verify(token, config.jwtSecret, {
      algorithms: ["HS256"],
    });

    if (typeof decoded === "string" || typeof decoded.sub !== "string") {
      return undefined;
    }

    return { sub: decoded.sub };
  } catch {
    return undefined;
  }
}

export function generateRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function refreshTokenExpiry(): Date {
  const expires = new Date();
  expires.setDate(expires.getDate() + config.refreshTokenTtlDays);
  return expires;
}
