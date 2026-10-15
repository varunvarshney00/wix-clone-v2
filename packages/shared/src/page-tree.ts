import { z } from "zod";

export const SCHEMA_VERSION = 1;

export const MAX_DEPTH = 4;
export const MAX_NODES = 200;
export const MAX_SECTIONS = 50;

const nodeId = z
  .string()
  .regex(/^[A-Za-z0-9_-]{8,32}$/, "node id must be 8-32 url-safe characters");

export const toneToken = z.enum(["default", "muted", "primary", "inverse"]);
export const alignToken = z.enum(["start", "center", "end"]);
export const spacingToken = z.enum(["none", "tight", "normal", "loose"]);

const headingNode = z.object({
  id: nodeId,
  type: z.literal("heading"),
  props: z.object({
    text: z.string().max(200),
    level: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(2),
    tone: toneToken.default("default"),
    align: alignToken.default("start"),
  }),
});

const textNode = z.object({
  id: nodeId,
  type: z.literal("text"),
  props: z.object({
    content: z.string().max(5_000),
    tone: toneToken.default("default"),
    align: alignToken.default("start"),
  }),
});

const imageNode = z.object({
  id: nodeId,
  type: z.literal("image"),
  props: z.object({
    mediaId: z.string().max(100).optional(),
    alt: z.string().max(200).default(""),
  }),
});

const buttonNode = z.object({
  id: nodeId,
  type: z.literal("button"),
  props: z.object({
    label: z.string().max(80),
    href: z
      .string()
      .regex(/^\/[A-Za-z0-9/_-]*$/, "href must be an internal path")
      .default("/"),
    tone: toneToken.default("primary"),
  }),
});

export type PageNode =
  | z.infer<typeof headingNode>
  | z.infer<typeof textNode>
  | z.infer<typeof imageNode>
  | z.infer<typeof buttonNode>
  | {
      id: string;
      type: "container";
      props: { columns: 1 | 2 | 3; gap: z.infer<typeof spacingToken> };
      children: PageNode[];
    };

const containerNode: z.ZodType<Extract<PageNode, { type: "container" }>> =
  z.lazy(() =>
    z.object({
      id: nodeId,
      type: z.literal("container"),
      props: z.object({
        columns: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(1),
        gap: spacingToken.default("normal"),
      }),
      children: z.array(pageNode).max(MAX_NODES),
    }),
  );

export const pageNode: z.ZodType<PageNode> = z.discriminatedUnion("type", [
  headingNode,
  textNode,
  imageNode,
  buttonNode,
  containerNode as never,
]);

export const pageSection = z.object({
  id: nodeId,
  type: z.enum(["hero", "content", "footer"]),
  props: z.object({
    tone: toneToken.default("default"),
    padding: spacingToken.default("normal"),
  }),
  children: z.array(pageNode).max(MAX_NODES),
});

export const pageTree = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  sections: z.array(pageSection).max(MAX_SECTIONS),
});

export type PageSection = z.infer<typeof pageSection>;
export type PageTree = z.infer<typeof pageTree>;

export const EMPTY_TREE: PageTree = {
  schemaVersion: SCHEMA_VERSION,
  sections: [],
};