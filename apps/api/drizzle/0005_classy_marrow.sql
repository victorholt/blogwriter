CREATE TABLE IF NOT EXISTS "shared_blogs" (
	"id" serial PRIMARY KEY NOT NULL,
	"hash" text NOT NULL,
	"blog_content" text NOT NULL,
	"brand_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "shared_blogs_hash_unique" UNIQUE("hash")
);
--> statement-breakpoint
ALTER TABLE "agent_model_configs" ADD COLUMN IF NOT EXISTS "show_preview" boolean DEFAULT false NOT NULL;
