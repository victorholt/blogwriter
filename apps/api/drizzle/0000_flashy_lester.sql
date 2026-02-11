CREATE TABLE IF NOT EXISTS "agent_model_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"agent_label" text NOT NULL,
	"model_id" text NOT NULL,
	"temperature" text DEFAULT '0.7',
	"max_tokens" text DEFAULT '4096',
	"instructions" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agent_model_configs_agent_id_unique" UNIQUE("agent_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "app_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"store_url" text,
	"brand_voice" text,
	"selected_dress_ids" text,
	"additional_instructions" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"generated_blog" text,
	"seo_metadata" text,
	"agent_log" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "brand_voice_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"analysis_result" text NOT NULL,
	"cached_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "brand_voice_cache_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cached_dresses" (
	"id" serial PRIMARY KEY NOT NULL,
	"external_id" text NOT NULL,
	"name" text NOT NULL,
	"designer" text,
	"description" text,
	"price" text,
	"image_url" text,
	"category" text,
	"tags" text,
	"style_id" text,
	"raw_data" text,
	"cached_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "cached_dresses_external_id_unique" UNIQUE("external_id")
);
