CREATE TABLE "saved_brand_voices" (
	"id" text PRIMARY KEY NOT NULL,
	"space_id" text NOT NULL,
	"name" text NOT NULL,
	"source_url" text,
	"voice_data" text NOT NULL,
	"is_default" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brand_labels" ADD COLUMN "website_url" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "brand_labels" ADD COLUMN "description" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "saved_brand_voices" ADD CONSTRAINT "saved_brand_voices_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_saved_brand_voices_space" ON "saved_brand_voices" USING btree ("space_id");