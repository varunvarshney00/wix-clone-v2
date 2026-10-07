import { describe, it, expect } from "vitest";
import { normalisePath } from "./page.service.js";

describe("normalisePath", () => {
  it("leaves a root path alone", () => {
    expect(normalisePath("/")).toBe("/");
  });

  it("adds a leading slash", () => {
    expect(normalisePath("about")).toBe("/about");
  });

  it("lowercases", () => {
    expect(normalisePath("/About-Us")).toBe("/about-us");
  });

  it("replaces spaces and punctuation with hyphens", () => {
    expect(normalisePath("Our Menu!")).toBe("/our-menu");
  });

  it("collapses repeated slashes", () => {
    expect(normalisePath("//blog///posts")).toBe("/blog/posts");
  });

  it("preserves nested paths", () => {
    expect(normalisePath("/blog/2026/hello-world")).toBe("/blog/2026/hello-world");
  });

  it("strips a trailing slash", () => {
    expect(normalisePath("/about/")).toBe("/about");
  });

  it("caps length at 200 characters", () => {
    expect(normalisePath(`/${"a".repeat(400)}`)).toHaveLength(200);
  });

  it("is idempotent", () => {
    const once = normalisePath("Our Menu!");
    expect(normalisePath(once)).toBe(once);
  });
});