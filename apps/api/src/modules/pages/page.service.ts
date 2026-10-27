import { ConflictError, NotFoundError, ValidationError, isUniqueViolation } from "../../shared/errors.js";
import type { Page } from "../../db/schema.js";
import * as siteService from "../sites/site.service.js";
import * as repository from "./page.repository.js";

import { validatePageTree, type PageTree } from "@wix-clone/shared";

const MAX_PAGES_PER_SITE = 100;

export function normalisePath(input: string): string {
  const trimmed = input.trim().toLowerCase();
  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const collapsed = withSlash.replace(/\/+/g, "/").replace(/[^a-z0-9/_-]+/g, "-");
  const cleaned = collapsed.replace(/-+/g, "-").replace(/-\/|\/-/g, "/");

  if (cleaned === "/") return "/";

  return cleaned.replace(/\/+$/, "").replace(/-+$/, "").slice(0, 200);
}

export async function createPage(
  orgId: string,
  siteId: string,
  input: { title: string; path: string },
): Promise<Page> {

  await siteService.getSiteById(orgId, siteId);

  const path = normalisePath(input.path);

  if (path.length === 0) {
    throw new ValidationError("could not derive a valid path", { field: "path", path: input.path });
  }

  const existing = await repository.listPagesBySite(orgId, siteId);

  if (existing.length >= MAX_PAGES_PER_SITE) {
    throw new ValidationError(`a site cannot have more than ${MAX_PAGES_PER_SITE} pages`, {
      limit: MAX_PAGES_PER_SITE,
    });
  }

  const isHome = existing.length === 0;

  try {
    return await repository.insertPage({ orgId, siteId, title: input.title, path, isHome });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError("a page with this path already exists in this site", { path });
    }
    throw error;
  }
}

export async function getPageById(orgId: string, siteId: string, id: string): Promise<Page> {
  const page = await repository.findPageById(orgId, siteId, id);

  if (!page) {
    throw new NotFoundError("page", id);
  }

  return page;
}

export async function listPages(orgId: string, siteId: string): Promise<Page[]> {
  await siteService.getSiteById(orgId, siteId);
  return repository.listPagesBySite(orgId, siteId);
}

export async function updatePage(
  orgId: string,
  siteId: string,
  id: string,
  input: { title?: string; path?: string },
): Promise<Page> {
  const data: { title?: string; path?: string } = {};

  if (input.title !== undefined) {
    data.title = input.title;
  }

  if (input.path !== undefined) {
    const path = normalisePath(input.path);

    if (path.length === 0) {
      throw new ValidationError("could not derive a valid path", { field: "path" });
    }

    data.path = path;
  }

  try {
    const page = await repository.updatePage(orgId, siteId, id, data);

    if (!page) {
      throw new NotFoundError("page", id);
    }

    return page;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError("a page with this path already exists in this site", {
        path: data.path,
      });
    }
    throw error;
  }
}

export async function deletePage(orgId: string, siteId: string, id: string): Promise<void> {
  const page = await repository.findPageById(orgId, siteId, id);

  if (!page) {
    throw new NotFoundError("page", id);
  }

  if (page.isHome) {
    throw new ConflictError("the home page cannot be deleted", { pageId: id });
  }

  await repository.deletePage(orgId, siteId, id);
}

export async function getPageTree(
  orgId: string,
  siteId: string,
  id: string,
): Promise<{ tree: PageTree; version: number; page: Page }> {
  const page = await getPageById(orgId, siteId, id);

  const result = validatePageTree(page.draftTree);

  if (!result.ok) {
    throw new Error(
      `stored tree for page ${id} is invalid: ${result.violations.map((v) => v.code).join(", ")}`,
    );
  }

  return { tree: result.tree, version: page.version, page };
}


export async function savePageTree(
  orgId: string,
  siteId: string,
  id: string,
  input: { tree: unknown; version: number },
): Promise<{ tree: PageTree; version: number }> {
  const validation = validatePageTree(input.tree);

  if (!validation.ok) {
    throw new ValidationError("page tree is not valid", {
      violations: validation.violations,
    });
  }

  const updated = await repository.updatePageTree(
    orgId,
    siteId,
    id,
    validation.tree,
    input.version,
  );

  if (updated) {
    return { tree: validation.tree, version: updated.version };
  }

  const current = await repository.findPageById(orgId, siteId, id);

  if (!current) {
    throw new NotFoundError("page", id);
  }

  throw new ConflictError("the page was modified by someone else", {
    yourVersion: input.version,
    currentVersion: current.version,
  });
}