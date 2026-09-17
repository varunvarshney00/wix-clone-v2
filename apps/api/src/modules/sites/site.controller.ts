import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { parseOrThrow } from "../../shared/validation.js";
import type { Site } from "../../db/schema.js";
import * as service from "./site.service.js";

const createSiteBody = z.object({
  name: z.string().trim().min(1).max(200),
  slug: z.string().trim().min(1).max(60).optional(),
});

const siteIdParams = z.object({
  id: z.uuid(),
});

const listSitesQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

function toSiteResponse(site: Site) {
  return {
    id: site.id,
    name: site.name,
    slug: site.slug,
    createdAt: site.createdAt.toISOString(),
    updatedAt: site.updatedAt.toISOString(),
  };
}

export async function createSiteHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const body = parseOrThrow(createSiteBody, request.body);
  const site = await service.createSite(body);

  return reply
    .code(201)
    .header("location", `/api/v1/sites/${site.id}`)
    .send(toSiteResponse(site));
}

export async function getSiteHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { id } = parseOrThrow(siteIdParams, request.params);
  const site = await service.getSiteById(id);

  return reply.send(toSiteResponse(site));
}

export async function listSitesHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const query = parseOrThrow(listSitesQuery, request.query);
  const sites = await service.listSites(query);

  return reply.send({
    data: sites.map(toSiteResponse),
    pagination: {
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
      count: sites.length,
    },
  });
}
