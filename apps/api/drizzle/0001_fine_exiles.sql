CREATE TABLE "agent_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"trace_id" text NOT NULL,
	"session_id" text,
	"agent_id" text NOT NULL,
	"event_type" text NOT NULL,
	"data" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_agent_logs_trace_id" ON "agent_logs" USING btree ("trace_id");--> statement-breakpoint
CREATE INDEX "idx_agent_logs_session_id" ON "agent_logs" USING btree ("session_id");