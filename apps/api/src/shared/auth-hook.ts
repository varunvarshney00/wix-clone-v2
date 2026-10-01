// Every protected request must contain a valid JWT access token. 
// If valid, extract the user's ID and attach it to the request.

import type { FastifyReply, FastifyRequest } from "fastify";
import { ForbiddenError, UnauthorizedError } from "./errors.js";
import { verifyAccessToken } from "../modules/auth/tokens.js";
import * as orgRepository from "../modules/orgs/org.repository.js";
import type { MemberRole } from "../db/schema.js";

export interface TenantContext {
  userId: string;
  orgId: string;
  role: MemberRole;
}

declare module "fastify" {
  interface FastifyRequest {
    tenant?: TenantContext;
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

  const requestedOrgId = request.headers["x-org-id"];

  const membership =
    typeof requestedOrgId === "string"
      ? await orgRepository.findMembership(payload.sub, requestedOrgId)
      : await orgRepository.findFirstMembershipForUser(payload.sub);

  if (!membership) {
    throw new ForbiddenError("no access to the requested organization");
  }

  request.tenant = {
    userId: payload.sub,
    orgId: membership.orgId,
    role: membership.role,
  };
}

export function getTenant(request: FastifyRequest): TenantContext {
  if (!request.tenant) {
    throw new UnauthorizedError("authentication required");
  }
  return request.tenant;
}

const ROLE_RANK: Record<MemberRole, number> = {
  viewer: 0,
  editor: 1,
  admin: 2,
  owner: 3,
};

export function requireRole(minimum: MemberRole) {
  return async function roleGuard(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    const tenant = getTenant(request);

    if (ROLE_RANK[tenant.role] < ROLE_RANK[minimum]) {
      throw new ForbiddenError(`this action requires the ${minimum} role or higher`);
    }
  };
}