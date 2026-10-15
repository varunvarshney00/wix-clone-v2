import { describe, it, expect } from "vitest";
import {
  EMPTY_TREE,
  MAX_DEPTH,
  SCHEMA_VERSION,
  validatePageTree,
  type PageTree,
} from "@wix-clone/shared";

function section(id: string, children: unknown[] = []) {
  return { id, type: "hero", props: {}, children };
}

function tree(sections: unknown[]): unknown {
  return { schemaVersion: SCHEMA_VERSION, sections };
}

function nestedContainers(depth: number): unknown {
  let node: unknown = {
    id: "leaf0001",
    type: "heading",
    props: { text: "deep" },
  };

  for (let i = 0; i < depth; i += 1) {
    node = {
      id: `cont${String(i).padStart(4, "0")}`,
      type: "container",
      props: {},
      children: [node],
    };
  }

  return node;
}

describe("validatePageTree", () => {
  it("accepts an empty tree", () => {
    const result = validatePageTree(EMPTY_TREE);
    expect(result.ok).toBe(true);
  });

  it("applies defaults to omitted props", () => {
    const result = validatePageTree(
      tree([
        section("sec00001", [
          { id: "hed00001", type: "heading", props: { text: "Hi" } },
        ]),
      ]),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const heading = result.tree.sections[0]?.children[0];
    expect(heading).toMatchObject({
      props: { level: 2, tone: "default", align: "start" },
    });
  });

  it("rejects an unknown component type", () => {
    const result = validatePageTree(
      tree([
        section("sec00001", [{ id: "vid00001", type: "video", props: {} }]),
      ]),
    );

    expect(result.ok).toBe(false);
  });

  it("rejects a raw colour in place of a tone token", () => {
    const result = validatePageTree(
      tree([
        section("sec00001", [
          {
            id: "hed00001",
            type: "heading",
            props: { text: "Hi", tone: "#ff0000" },
          },
        ]),
      ]),
    );

    expect(result.ok).toBe(false);
  });

  it("rejects a javascript: href", () => {
    const result = validatePageTree(
      tree([
        section("sec00001", [
          {
            id: "btn00001",
            type: "button",
            props: { label: "Click", href: "javascript:alert(1)" },
          },
        ]),
      ]),
    );

    expect(result.ok).toBe(false);
  });

  it("rejects duplicate node ids", () => {
    const result = validatePageTree(
      tree([
        section("dup00001", [
          { id: "dup00001", type: "heading", props: { text: "Hi" } },
        ]),
      ]),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.violations.some((v) => v.code === "duplicate_node_id")).toBe(
      true,
    );
  });

  it("rejects nesting deeper than the maximum", () => {
    const result = validatePageTree(
      tree([section("sec00001", [nestedContainers(MAX_DEPTH + 3)])]),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.violations.some((v) => v.code === "depth_exceeded")).toBe(
      true,
    );
  });

  it("accepts nesting at the maximum depth", () => {
    const result = validatePageTree(
      tree([section("sec00001", [nestedContainers(2)])]),
    );

    expect(result.ok).toBe(true);
  });

  it("rejects more nodes than the maximum", () => {
    const children = Array.from({ length: 250 }, (_, i) => ({
      id: `hed${String(i).padStart(5, "0")}`,
      type: "heading",
      props: { text: `H${i}` },
    }));

    const result = validatePageTree(tree([section("sec00001", children)]));

    expect(result.ok).toBe(false);
  });

  it("rejects a mismatched schema version", () => {
    const result = validatePageTree({ schemaVersion: 99, sections: [] });

    expect(result.ok).toBe(false);
  });

  it("stores script content as-is rather than stripping it", () => {
    const payload = "<script>alert(1)</script>";
    const result = validatePageTree(
      tree([
        section("sec00001", [
          { id: "txt00001", type: "text", props: { content: payload } },
        ]),
      ]),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Escaping belongs to the renderer, not to storage.
    const node = result.tree.sections[0]?.children[0] as {
      props: { content: string };
    };
    expect(node.props.content).toBe(payload);
  });
});
