import { describe, it, expect } from "vitest";
import { slugify } from "./slug.js";

describe("slugify", () => {
  it("lowercases and hyphenates words", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("removes apostrophes without leaving a separator", () => {
    expect(slugify("Joe's Pizza")).toBe("joes-pizza");
  });

  it("strips accents down to base letters", () => {
    expect(slugify("Café Münchén")).toBe("cafe-munchen");
  });

  it("collapses runs of punctuation into a single hyphen", () => {
    expect(slugify("Hello!!! World???")).toBe("hello-world");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("  !Hello World!  ")).toBe("hello-world");
  });

  it("caps length at 60 characters", () => {
    const result = slugify("a".repeat(200));
    expect(result).toHaveLength(60);
  });

  it("is idempotent — slugifying a slug changes nothing", () => {
    const once = slugify("Joe's Pizza Palace");
    expect(slugify(once)).toBe(once);
  });

  it("returns an empty string for scripts it cannot transliterate", () => {
    expect(slugify("नमस्ते")).toBe("");
    expect(slugify("你好")).toBe("");
  });
});

