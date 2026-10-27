ALTER TABLE "pages" ALTER COLUMN "draft_tree" SET DEFAULT '{"schemaVersion":1,"sections":[]}'::jsonb;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;