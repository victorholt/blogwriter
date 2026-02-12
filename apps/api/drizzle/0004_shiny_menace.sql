CREATE TABLE IF NOT EXISTS "agent_additional_instructions" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_additional_instructions_agent_id" ON "agent_additional_instructions" USING btree ("agent_id");
