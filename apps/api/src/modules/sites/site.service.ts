import { ConflictError, NotFoundError, ValidationError, isUniqueViolation } from "../../shared/errors.js";
import type { Site } from "../../db/schema.js";
import * as repository from "./site.repository.js";
import { slugify } from "./slug.js";

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

export interface CreateSiteInput {
  name: string;
  slug?: string;
}

export async function createSite(input: CreateSiteInput): Promise<Site> {
  const slug = input.slug ? slugify(input.slug) : slugify(input.name);

  if (slug.length === 0) {
    throw new ValidationError("could not derive a url-safe slug from the given name", {
      field: "slug",
      name: input.name,
    });
  }

  try {
    return await repository.insertSite({ name: input.name, slug });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError("a site with this slug already exists", { slug });
    }
    throw error;
  }
}

export async function getSiteById(id: string): Promise<Site> {
  const site = await repository.findSiteById(id);

  if (!site) {
    throw new NotFoundError("site", id);
  }

  return site;
}

export async function listSites(options: { limit?: number; offset?: number } = {}): Promise<Site[]> {
  const limit = Math.min(options.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const offset = Math.max(options.offset ?? 0, 0);

  return repository.listSites(limit, offset);
}