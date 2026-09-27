// Every protected request must contain a valid JWT access token. 
// If valid, extract the user's ID and attach it to the request.

import type { FastifyReply, FastifyRequest } from "fastify";
import { UnauthorizedError } from "./errors.js";
import { verifyAccessToken } from "../modules/auth/tokens.js";

declare module "fastify" {
  interface FastifyRequest {
    userId?: string;
  }
}

export async function requireAuth(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const header = request.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    throw new UnauthorizedError("authentication required");
  }

  const payload = verifyAccessToken(header.slice("Bearer ".length));

  if (!payload) {
    throw new UnauthorizedError("invalid or expired token");
  }

  request.userId = payload.sub;
}