import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { parseOrThrow } from "../../shared/validation.js";
import { UnauthorizedError } from "../../shared/errors.js";
import type { User } from "../../db/schema.js";
import * as service from "./auth.service.js";
import { getTenant } from "../../shared/auth-hook.js";

const credentials = z.object({
  email: z.email().max(255),
  password: z.string().min(12).max(200),
  organizationName: z.string().trim().min(1).max(200).optional(),
});

const refreshBody = z.object({
  refreshToken: z.string().min(1),
});

function toUserResponse(user: User) {
  return {
    id: user.id,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function registerHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const body = parseOrThrow(credentials, request.body);
  const result = await service.register(body);

  return reply.code(201).send({
    user: toUserResponse(result.user),
    organization: {
      id: result.organization.id,
      name: result.organization.name,
    },
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
  });
}

export async function loginHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const body = parseOrThrow(credentials, request.body);
  const result = await service.login(body);

  return reply.send({
    user: toUserResponse(result.user),
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
  });
}

export async function refreshHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const body = parseOrThrow(refreshBody, request.body);
  const tokens = await service.refresh(body.refreshToken);

  return reply.send(tokens);
}

export async function logoutHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const body = parseOrThrow(refreshBody, request.body);
  await service.logout(body.refreshToken);

  return reply.code(204).send();
}

export async function meHandler(request: FastifyRequest, reply: FastifyReply) {
  const { userId, orgId, role } = getTenant(request);
  const user = await service.getUserById(userId);

  if (!user) {
    throw new UnauthorizedError("authentication required");
  }

  return reply.send({ ...toUserResponse(user), orgId, role });
}
