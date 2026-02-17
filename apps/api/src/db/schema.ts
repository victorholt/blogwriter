import { pgTable, serial, text, timestamp, index, boolean, integer, uniqueIndex } from 'drizzle-orm/pg-core';

// ============================================================
// Auth & Spaces
// ============================================================

export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name').notNull(),
  role: text('role').default('user').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  lastLoginAt: timestamp('last_login_at'),
  passwordResetToken: text('password_reset_token'),
  passwordResetExpiresAt: timestamp('password_reset_expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const spaces = pgTable('spaces', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  ownerId: text('owner_id').notNull().references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const spaceMembers = pgTable('space_members', {
  id: serial('id').primaryKey(),
  spaceId: text('space_id').notNull().references(() => spaces.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').default('owner').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_space_members_space').on(table.spaceId),
  index('idx_space_members_user').on(table.userId),
  uniqueIndex('idx_space_members_unique').on(table.spaceId, table.userId),
]);

// ============================================================
// Audit
// ============================================================

export const auditLogs = pgTable('audit_logs', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id'),
  spaceId: text('space_id'),
  action: text('action').notNull(),
  resourceType: text('resource_type'),
  resourceId: text('resource_id'),
  metadata: text('metadata'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_audit_logs_user').on(table.userId),
  index('idx_audit_logs_action').on(table.action),
  index('idx_audit_logs_created').on(table.createdAt),
]);

// ============================================================
// Agent Configuration
// ============================================================

export const agentModelConfigs = pgTable('agent_model_configs', {
  id: serial('id').primaryKey(),
  agentId: text('agent_id').notNull().unique(),
  agentLabel: text('agent_label').notNull(),
  modelId: text('model_id').notNull(),
  temperature: text('temperature').default('0.7'),
  maxTokens: text('max_tokens').default('4096'),
  instructions: text('instructions'),
  enabled: boolean('enabled').default(true).notNull(),
  showPreview: boolean('show_preview').default(false).notNull(),
  maxRetries: integer('max_retries').default(3).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const agentAdditionalInstructions = pgTable('agent_additional_instructions', {
  id: serial('id').primaryKey(),
  agentId: text('agent_id').notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_additional_instructions_agent_id').on(table.agentId),
]);

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

// ============================================================
// Blog Sessions & Sharing
// ============================================================

export const blogSessions = pgTable('blog_sessions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  spaceId: text('space_id').references(() => spaces.id),
  title: text('title'),
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

export const sharedBlogs = pgTable('shared_blogs', {
  id: serial('id').primaryKey(),
  hash: text('hash').notNull().unique(),
  blogContent: text('blog_content').notNull(),
  brandName: text('brand_name'),
  sourceSessionId: text('source_session_id'),
  sourceSpaceId: text('source_space_id'),
  targetSpaceId: text('target_space_id'),
  sharedByUserId: text('shared_by_user_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================
// Caching
// ============================================================

export const brandVoiceCache = pgTable('brand_voice_cache', {
  id: serial('id').primaryKey(),
  url: text('url').notNull().unique(),
  analysisResult: text('analysis_result').notNull(),
  cachedAt: timestamp('cached_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
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

// ============================================================
// App Settings & Content
// ============================================================

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

export const voicePresets = pgTable('voice_presets', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  rawSourceText: text('raw_source_text'),
  formattedVoice: text('formatted_voice'),
  additionalInstructions: text('additional_instructions'),
  isActive: boolean('is_active').default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
