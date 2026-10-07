import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { parseOrThrow } from "../../shared/validation.js";
import { getTenant } from "../../shared/auth-hook.js";
import type { Page } from "../../db/schema.js";
import * as service from "./page.service.js";

const siteParams = z.object({
  siteId: z.uuid(),
});

const pageParams = z.object({
  siteId: z.uuid(),
  pageId: z.uuid(),
});

const createPageBody = z.object({
  title: z.string().trim().min(1).max(200),
  path: z.string().trim().min(1).max(200),
});

const updatePageBody = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    path: z.string().trim().min(1).max(200).optional(),
  })
  .refine((data) => data.title !== undefined || data.path !== undefined, {
    message: "at least one of title or path must be provided",
  });

function toPageResponse(page: Page) {
  return {
    id: page.id,
    siteId: page.siteId,
    title: page.title,
    path: page.path,
    isHome: page.isHome,
    createdAt: page.createdAt.toISOString(),
    updatedAt: page.updatedAt.toISOString(),
  };
}

export async function createPageHandler(request: FastifyRequest, reply: FastifyReply) {
  const { orgId } = getTenant(request);
  const { siteId } = parseOrThrow(siteParams, request.params);
  const body = parseOrThrow(createPageBody, request.body);

  const page = await service.createPage(orgId, siteId, body);

  return reply
    .code(201)
    .header("location", `/api/v1/sites/${siteId}/pages/${page.id}`)
    .send(toPageResponse(page));
}

export async function listPagesHandler(request: FastifyRequest, reply: FastifyReply) {
  const { orgId } = getTenant(request);
  const { siteId } = parseOrThrow(siteParams, request.params);

  const pages = await service.listPages(orgId, siteId);

  return reply.send({ data: pages.map(toPageResponse) });
}

export async function getPageHandler(request: FastifyRequest, reply: FastifyReply) {
  const { orgId } = getTenant(request);
  const { siteId, pageId } = parseOrThrow(pageParams, request.params);

  const page = await service.getPageById(orgId, siteId, pageId);

  return reply.send(toPageResponse(page));
}

export async function updatePageHandler(request: FastifyRequest, reply: FastifyReply) {
  const { orgId } = getTenant(request);
  const { siteId, pageId } = parseOrThrow(pageParams, request.params);
  const body = parseOrThrow(updatePageBody, request.body);

  const page = await service.updatePage(orgId, siteId, pageId, body);

  return reply.send(toPageResponse(page));
}

export async function deletePageHandler(request: FastifyRequest, reply: FastifyReply) {
  const { orgId } = getTenant(request);
  const { siteId, pageId } = parseOrThrow(pageParams, request.params);

  await service.deletePage(orgId, siteId, pageId);

  return reply.code(204).send();
}