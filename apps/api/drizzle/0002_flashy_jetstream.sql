ALTER TABLE "agent_model_configs" ADD COLUMN IF NOT EXISTS "enabled" boolean DEFAULT true NOT NULL;
