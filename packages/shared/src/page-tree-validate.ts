import {
  MAX_DEPTH,
  MAX_NODES,
  pageTree,
  type PageNode,
  type PageTree,
} from "./page-tree.js";

export interface TreeViolation {
  code: "depth_exceeded" | "too_many_nodes" | "duplicate_node_id";
  message: string;
  nodeId?: string;
}

export function validatePageTree(
  input: unknown,
): { ok: true; tree: PageTree } | { ok: false; violations: TreeViolation[] } {
  const parsed = pageTree.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      violations: [
        {
          code: "too_many_nodes",
          message: "tree does not match the expected shape",
        },
      ],
    };
  }

  const violations = checkTreeLimits(parsed.data);

  if (violations.length > 0) {
    return { ok: false, violations };
  }

  return { ok: true, tree: parsed.data };
}

export function checkTreeLimits(tree: PageTree): TreeViolation[] {
  const violations: TreeViolation[] = [];
  const seenIds = new Set<string>();
  let nodeCount = 0;

  function visit(node: PageNode, depth: number): void {
    nodeCount += 1;

    if (seenIds.has(node.id)) {
      violations.push({
        code: "duplicate_node_id",
        message: `node id ${node.id} appears more than once`,
        nodeId: node.id,
      });
    }
    seenIds.add(node.id);

    if (depth > MAX_DEPTH) {
      violations.push({
        code: "depth_exceeded",
        message: `nesting exceeds the maximum depth of ${MAX_DEPTH}`,
        nodeId: node.id,
      });
      return;
    }

    if (node.type === "container") {
      for (const child of node.children) {
        visit(child, depth + 1);
      }
    }
  }

  for (const section of tree.sections) {
    nodeCount += 1;

    if (seenIds.has(section.id)) {
      violations.push({
        code: "duplicate_node_id",
        message: `node id ${section.id} appears more than once`,
        nodeId: section.id,
      });
    }
    seenIds.add(section.id);

    for (const child of section.children) {
      visit(child, 2);
    }
  }

  if (nodeCount > MAX_NODES) {
    violations.push({
      code: "too_many_nodes",
      message: `tree contains ${nodeCount} nodes, the maximum is ${MAX_NODES}`,
    });
  }

  return violations;
}
