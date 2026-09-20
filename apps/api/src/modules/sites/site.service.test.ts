import { beforeEach, afterAll, describe, it, expect } from "vitest";
import { closePool } from "../../db/pool.js";
import { truncateAll } from "../../test/setup.js";
import { ConflictError, NotFoundError, ValidationError } from "../../shared/errors.js";
import * as service from "./site.service.js";

beforeEach(async () => {
  await truncateAll();
});

afterAll(async () => {
  await closePool();
});

describe("createSite", () => {
  it("derives a slug from the name", async () => {
    const site = await service.createSite({ name: "Joe's Pizza Palace" });

    expect(site.slug).toBe("joes-pizza-palace");
    expect(site.name).toBe("Joe's Pizza Palace");
    expect(site.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}/);
  });

  it("accepts an explicit slug and still sanitises it", async () => {
    const site = await service.createSite({ name: "Anything", slug: "My Custom Slug!" });

    expect(site.slug).toBe("my-custom-slug");
  });

  it("rejects a duplicate slug with ConflictError", async () => {
    await service.createSite({ name: "Joe's Pizza" });

    await expect(service.createSite({ name: "Joes Pizza" })).rejects.toThrow(ConflictError);
  });

  it("rejects a name that cannot produce a slug", async () => {
    await expect(service.createSite({ name: "नमस्ते" })).rejects.toThrow(ValidationError);
  });

  it("sets createdAt and updatedAt to the same value on creation", async () => {
    const site = await service.createSite({ name: "Timestamps" });

    expect(site.createdAt.getTime()).toBe(site.updatedAt.getTime());
  });
});

describe("getSiteById", () => {
  it("returns the site when it exists", async () => {
    const created = await service.createSite({ name: "Findable" });
    const found = await service.getSiteById(created.id);

    expect(found.id).toBe(created.id);
  });

  it("throws NotFoundError for an unknown id", async () => {
    await expect(
      service.getSiteById("00000000-0000-0000-0000-000000000000"),
    ).rejects.toThrow(NotFoundError);
  });
});

describe("listSites", () => {
  it("returns newest first", async () => {
    await service.createSite({ name: "First" });
    await service.createSite({ name: "Second" });
    await service.createSite({ name: "Third" });

    const sites = await service.listSites();

    expect(sites.map((s) => s.slug)).toEqual(["third", "second", "first"]);
  });

  it("clamps an oversized limit to 100", async () => {
    for (let i = 1; i <= 105; i += 1) {
      await service.createSite({ name: `Site ${i}` });
    }

    const sites = await service.listSites({ limit: 999999 });

    expect(sites).toHaveLength(100);
  });

  it("applies offset", async () => {
    await service.createSite({ name: "First" });
    await service.createSite({ name: "Second" });

    const sites = await service.listSites({ limit: 10, offset: 1 });

    expect(sites).toHaveLength(1);
    expect(sites[0]?.slug).toBe("first");
  });
});