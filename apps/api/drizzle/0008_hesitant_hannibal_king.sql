ALTER TABLE "brand_labels" ADD COLUMN "seo_keywords" text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE "brand_labels" ADD COLUMN "avoid_terms" text DEFAULT '[]' NOT NULL;