CREATE TABLE "pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"title" text NOT NULL,
	"path" text NOT NULL,
	"is_home" boolean DEFAULT false NOT NULL,
	"draft_tree" jsonb DEFAULT '{"sections":[]}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pages_site_path_unique" UNIQUE("site_id","path")
);
--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pages_site_home_unique" ON "pages" USING btree ("site_id") WHERE is_home = true;--> statement-breakpoint
CREATE INDEX "pages_org_site_idx" ON "pages" USING btree ("org_id","site_id");