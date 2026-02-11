import { pgTable, serial, text, timestamp, index, boolean, integer } from 'drizzle-orm/pg-core';

export const agentModelConfigs = pgTable('agent_model_configs', {
  id: serial('id').primaryKey(),
  agentId: text('agent_id').notNull().unique(),
  agentLabel: text('agent_label').notNull(),
  modelId: text('model_id').notNull(),
  temperature: text('temperature').default('0.7'),
  maxTokens: text('max_tokens').default('4096'),
  instructions: text('instructions'),
  enabled: boolean('enabled').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const brandVoiceCache = pgTable('brand_voice_cache', {
  id: serial('id').primaryKey(),
  url: text('url').notNull().unique(),
  analysisResult: text('analysis_result').notNull(),
  cachedAt: timestamp('cached_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
});

export const blogSessions = pgTable('blog_sessions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  storeUrl: text('store_url'),
  brandVoice: text('brand_voice'),
  selectedDressIds: text('selected_dress_ids'),
  additionalInstructions: text('additional_instructions'),
  themeId: text('theme_id'),
  brandLabelSlug: text('brand_label_slug'),
  status: text('status').default('draft').notNull(),
  generatedBlog: text('generated_blog'),
  seoMetadata: text('seo_metadata'),
  agentLog: text('agent_log'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const cachedDresses = pgTable('cached_dresses', {
  id: serial('id').primaryKey(),
  externalId: text('external_id').notNull().unique(),
  name: text('name').notNull(),
  designer: text('designer'),
  description: text('description'),
  price: text('price'),
  imageUrl: text('image_url'),
  category: text('category'),
  tags: text('tags'),
  styleId: text('style_id'),
  rawData: text('raw_data'),
  brandSlug: text('brand_slug'),
  cachedAt: timestamp('cached_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
});

export const agentLogs = pgTable('agent_logs', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  traceId: text('trace_id').notNull(),
  sessionId: text('session_id'),
  agentId: text('agent_id').notNull(),
  eventType: text('event_type').notNull(),
  data: text('data').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_agent_logs_trace_id').on(table.traceId),
  index('idx_agent_logs_session_id').on(table.sessionId),
]);

export const appSettings = pgTable('app_settings', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const themes = pgTable('themes', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const brandLabels = pgTable('brand_labels', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  displayName: text('display_name').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
