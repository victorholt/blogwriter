import { db } from './index';
import { agentModelConfigs, appSettings, brandLabels, feedbackForms, docsPages, users, spaces, spaceMembers } from './schema';
import { sql, eq } from 'drizzle-orm';
import { hashPassword } from '../services/auth';

const DEFAULT_MODEL = 'openrouter/anthropic/claude-sonnet-4.5';

const DEFAULT_AGENTS = [
  { agentId: 'brand-voice-analyzer', agentLabel: 'Brand Voice Analyzer', modelId: DEFAULT_MODEL, temperature: '0.5', maxTokens: '4096' },
  { agentId: 'blog-writer', agentLabel: 'Blog Writer', modelId: DEFAULT_MODEL, temperature: '0.8', maxTokens: '8192' },
  { agentId: 'blog-editor', agentLabel: 'Blog Editor', modelId: DEFAULT_MODEL, temperature: '0.5', maxTokens: '4096' },
  { agentId: 'seo-specialist', agentLabel: 'SEO Specialist', modelId: DEFAULT_MODEL, temperature: '0.4', maxTokens: '4096' },
  { agentId: 'senior-editor', agentLabel: 'Senior Editor', modelId: DEFAULT_MODEL, temperature: '0.5', maxTokens: '4096' },
  { agentId: 'blog-reviewer', agentLabel: 'Blog Reviewer', modelId: DEFAULT_MODEL, temperature: '0.3', maxTokens: '4096' },
  { agentId: 'text-enhancer', agentLabel: 'Text Enhancer', modelId: DEFAULT_MODEL, temperature: '0.7', maxTokens: '2048' },
  { agentId: 'brand-voice-fast', agentLabel: 'Brand Voice (Fast)', modelId: DEFAULT_MODEL, temperature: '0.5', maxTokens: '4096', enabled: false },
  { agentId: 'brand-voice-formatter', agentLabel: 'Brand Voice Formatter', modelId: DEFAULT_MODEL, temperature: '0.4', maxTokens: '4096' },
  { agentId: 'voice-merger', agentLabel: 'Voice Merger', modelId: DEFAULT_MODEL, temperature: '0.4', maxTokens: '4096' },
  { agentId: 'feedback-reviewer', agentLabel: 'Feedback Reviewer', modelId: DEFAULT_MODEL, temperature: '0.3', maxTokens: '1024', enabled: false },
];

const DEFAULT_SETTINGS = [
  { key: 'app_name', value: 'BlogWriter' },
  { key: 'app_url', value: '' },
  { key: 'openrouter_api_key', value: '' },
  { key: 'product_api_base_url', value: 'https://product.dev.essensedesigns.info' },
  { key: 'product_api_timeout', value: '30000' },
  { key: 'product_api_language', value: 'en' },
  { key: 'product_api_type', value: 'essense-dress' },
  { key: 'product_api_app', value: 'essense-designs' },
  { key: 'allowed_dress_ids', value: '' },
  { key: 'debug_mode', value: 'false' },
  { key: 'insights_enabled', value: 'true' },
  { key: 'blog_timeline_style', value: 'preview-bar' },
  { key: 'blog_generate_images', value: 'true' },
  { key: 'blog_generate_links', value: 'true' },
  { key: 'blog_sharing_enabled', value: 'false' },
  { key: 'guest_mode_enabled', value: 'true' },
  { key: 'smtp_host', value: '' },
  { key: 'smtp_port', value: '587' },
  { key: 'smtp_user', value: '' },
  { key: 'smtp_password', value: '' },
  { key: 'smtp_from_email', value: '' },
  { key: 'smtp_from_name', value: 'BlogWriter' },
  { key: 'smtp_secure', value: 'true' },
  { key: 'smtp_encryption', value: 'none' },
  { key: 'smtp_auto_tls', value: 'true' },
  { key: 'smtp_auth', value: 'true' },
  { key: 'feedback_enabled', value: 'false' },
  { key: 'feedback_widget_enabled', value: 'false' },
  { key: 'feedback_agent_enabled', value: 'false' },
  { key: 'docs_enabled', value: 'true' },
  { key: 'media_allowed_types', value: 'image/jpeg,image/png,image/gif,image/webp,image/svg+xml,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/csv' },
];

const PILOT_SURVEY_QUESTIONS = JSON.stringify([
  { id: 'contentWorkflow', section: 1, required: true, type: 'radio', question: 'How does your team currently handle blog content?', options: [
    { value: 'established', label: 'Established', description: 'We follow a consistent, defined content calendar.' },
    { value: 'ad_hoc', label: 'Ad Hoc', description: 'We create content when we have time or inspiration.' },
    { value: 'none', label: 'None', description: 'We rarely or never publish blog content.' },
  ]},
  { id: 'draftReadiness', section: 1, required: true, type: 'radio', question: 'How close was the AI\'s draft to being "ready to publish"?', options: [
    { value: 'ready', label: 'Ready to Ship', description: 'I could post this with zero or very minor tweaks.' },
    { value: 'polishing', label: 'Polishing Needed', description: 'I made light edits to align it with my brand.' },
    { value: 'draft', label: 'Draft Only', description: 'I used it as a structural outline but rewrote significant portions.' },
    { value: 'not_usable', label: 'Not Usable', description: 'The content did not meet my quality or brand standards.' },
  ]},
  { id: 'timeComparison', section: 1, required: true, type: 'radio', question: 'Compared to your usual way of working, using this tool felt:', options: [
    { value: 'much_faster', label: 'Much faster', description: 'Saved hours of work' },
    { value: 'somewhat_faster', label: 'Somewhat faster', description: 'Saved some time' },
    { value: 'neutral', label: 'Neutral', description: 'Took about the same effort' },
    { value: 'more_work', label: 'More work', description: 'Editing/fixing took longer than writing from scratch' },
  ]},
  { id: 'brandConfidence', section: 1, required: true, type: 'radio', question: 'How confident would you feel letting this tool represent your store\'s brand?', options: [
    { value: 'high', label: 'High Confidence', description: 'I trust the tone and accuracy.' },
    { value: 'moderate', label: 'Moderate Confidence', description: 'I\'d use it, but I\'d always check the \'vibe\' first.' },
    { value: 'low', label: 'Low Confidence', description: 'I\'m hesitant; it doesn\'t quite sound like us yet.' },
    { value: 'none', label: 'No Confidence', description: 'I wouldn\'t trust it to represent our brand.' },
  ]},
  { id: 'improvement', section: 2, required: false, type: 'textarea', question: 'If you could change one specific thing to make this tool more helpful, what would it be?' },
  { id: 'role', section: 3, required: true, type: 'radio', question: 'Your Role:', options: [
    { value: 'owner', label: 'Store Owner' },
    { value: 'manager', label: 'Store Manager / Employee' },
    { value: 'corporate', label: 'Corporate Team' },
  ]},
  { id: 'businessType', section: 3, required: true, type: 'radio', question: 'Business Type:', options: [
    { value: 'single', label: 'Single Boutique Location' },
    { value: 'multi', label: 'Multi-Location / Regional Group' },
  ]},
]);

async function ensureSchemaColumns(): Promise<void> {
  // brand_labels: website_url + description added in d424b64
  await db.execute(sql`ALTER TABLE "brand_labels" ADD COLUMN IF NOT EXISTS "website_url"  text NOT NULL DEFAULT ''`);
  await db.execute(sql`ALTER TABLE "brand_labels" ADD COLUMN IF NOT EXISTS "description"  text NOT NULL DEFAULT ''`);

  // users: store_code added in dd00d0f
  await db.execute(sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "store_code" text`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "feedback_forms" (
      "id"          text PRIMARY KEY NOT NULL,
      "name"        text NOT NULL,
      "slug"        text NOT NULL UNIQUE,
      "type"        text NOT NULL DEFAULT 'form',
      "description" text,
      "questions"   text NOT NULL DEFAULT '[]',
      "is_active"   boolean NOT NULL DEFAULT true,
      "is_default"  boolean NOT NULL DEFAULT false,
      "sort_order"  integer NOT NULL DEFAULT 0,
      "created_at"  timestamp NOT NULL DEFAULT now(),
      "updated_at"  timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "feedback_responses" (
      "id"                text PRIMARY KEY NOT NULL,
      "form_id"           text REFERENCES "feedback_forms"("id") ON DELETE SET NULL,
      "form_slug"         text NOT NULL,
      "user_id"           text REFERENCES "users"("id") ON DELETE SET NULL,
      "store_code"        text,
      "answers"           text NOT NULL,
      "agent_review"      text,
      "agent_reviewed_at" timestamp,
      "status"            text NOT NULL DEFAULT 'new',
      "admin_notes"       text,
      "created_at"        timestamp NOT NULL DEFAULT now(),
      "updated_at"        timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_feedback_responses_form"    ON "feedback_responses"("form_id")`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_feedback_responses_status"  ON "feedback_responses"("status")`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_feedback_responses_created" ON "feedback_responses"("created_at")`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "docs_pages" (
      "id"           text PRIMARY KEY NOT NULL,
      "slug"         text NOT NULL UNIQUE,
      "title"        text NOT NULL,
      "content"      text NOT NULL DEFAULT '',
      "parent_id"    text,
      "sort_order"   integer NOT NULL DEFAULT 0,
      "is_published" boolean NOT NULL DEFAULT false,
      "is_default"   boolean NOT NULL DEFAULT false,
      "updated_by"   text,
      "created_at"   timestamp NOT NULL DEFAULT now(),
      "updated_at"   timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`ALTER TABLE "docs_pages" ADD COLUMN IF NOT EXISTS "is_default" boolean NOT NULL DEFAULT false`);

  // Expand media_allowed_types to include document types (idempotent: only updates if still image-only default)
  await db.execute(sql`
    UPDATE "app_settings"
    SET "value" = 'image/jpeg,image/png,image/gif,image/webp,image/svg+xml,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/csv'
    WHERE "key" = 'media_allowed_types'
      AND "value" = 'image/jpeg,image/png,image/gif,image/webp,image/svg+xml'
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "media_files" (
      "id"           text PRIMARY KEY NOT NULL,
      "filename"     text NOT NULL,
      "storage_path" text NOT NULL,
      "url"          text NOT NULL,
      "mime_type"    text NOT NULL,
      "size"         integer NOT NULL,
      "width"        integer,
      "height"       integer,
      "parent_id"    text,
      "alt"          text NOT NULL DEFAULT '',
      "uploaded_by"  text,
      "created_at"   timestamp NOT NULL DEFAULT now()
    )
  `);
}

export async function seedDatabase(): Promise<void> {
  console.log('[Seed] Checking for default data...');

  // Seed agent configs (ON CONFLICT DO NOTHING)
  for (const agent of DEFAULT_AGENTS) {
    await db.insert(agentModelConfigs)
      .values(agent)
      .onConflictDoNothing({ target: agentModelConfigs.agentId });
  }
  console.log(`[Seed] Agent configs: ${DEFAULT_AGENTS.length} defaults ensured`);

  // Seed app settings (ON CONFLICT DO NOTHING)
  for (const setting of DEFAULT_SETTINGS) {
    await db.insert(appSettings)
      .values(setting)
      .onConflictDoNothing({ target: appSettings.key });
  }
  console.log(`[Seed] App settings: ${DEFAULT_SETTINGS.length} defaults ensured`);

  // Seed brand labels (ON CONFLICT DO NOTHING)
  const DEFAULT_BRAND_LABELS = [
    { slug: 'essense-dress', displayName: 'Essense of Australia', sortOrder: 1 },
    { slug: 'martina-dress', displayName: 'Martina Liana', sortOrder: 2 },
    { slug: 'luxe-dress', displayName: 'Martina Liana Luxe', sortOrder: 3 },
    { slug: 'sorella-dress', displayName: 'Sorella Vita', sortOrder: 4 },
    { slug: 'wander-dress', displayName: 'All Who Wander', sortOrder: 5 },
    { slug: 'stella-dress', displayName: 'Stella York', sortOrder: 6 },
  ];
  for (const label of DEFAULT_BRAND_LABELS) {
    await db.insert(brandLabels)
      .values(label)
      .onConflictDoNothing({ target: brandLabels.slug });
  }
  console.log(`[Seed] Brand labels: ${DEFAULT_BRAND_LABELS.length} defaults ensured`);

  // Ensure feedback tables exist (drizzle-kit push may fail in some envs)
  await ensureSchemaColumns();

  // Seed pilot feedback form (ON CONFLICT DO NOTHING on slug)
  await db.insert(feedbackForms)
    .values({
      name: 'Pilot Survey',
      slug: 'pilot-v1',
      type: 'form',
      description: 'Initial pilot feedback survey for boutique bridal stores.',
      questions: PILOT_SURVEY_QUESTIONS,
      isActive: true,
      isDefault: true,
      sortOrder: 0,
    })
    .onConflictDoNothing({ target: feedbackForms.slug });
  console.log('[Seed] Feedback forms: pilot survey ensured');

  // Seed starter docs page (ON CONFLICT DO NOTHING on slug)
  await db.insert(docsPages)
    .values({
      slug: 'getting-started',
      title: 'Getting Started',
      content: `# Getting Started

Welcome to **BlogWriter** — your AI-powered blog writing assistant.

## What is BlogWriter?

BlogWriter helps bridal boutiques create high-quality, on-brand blog content in minutes. It analyzes your brand voice and uses AI agents to generate, edit, and refine blog posts around your dress collections.

## Creating Your First Blog

1. Click **New Blog** in the top navigation
2. Enter your store information and select your dresses
3. Analyze your brand voice (or use the default settings)
4. Watch the AI agents generate your blog post

## Managing Your Content

Use the **My Blogs** section to view, edit, and share all your generated posts.

## Getting Help

Browse the sidebar to explore all documentation topics, or use the search bar to find what you need.`,
      sortOrder: 0,
      isPublished: true,
      isDefault: true,
    })
    .onConflictDoNothing({ target: docsPages.slug });
  console.log('[Seed] Docs: getting-started page ensured');

  // Ensure admin user exists with admin role (idempotent)
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@blogwriter.local').toLowerCase().trim();
  const [existingAdmin] = await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.email, adminEmail)).limit(1);

  if (!existingAdmin) {
    const adminPassword = process.env.ADMIN_PASSWORD || crypto.randomUUID().slice(0, 16);
    const adminName = 'Admin';

    const passwordHash = await hashPassword(adminPassword);
    const [adminUser] = await db.insert(users).values({
      email: adminEmail,
      passwordHash,
      displayName: adminName,
      role: 'admin',
    }).returning();

    const [adminSpace] = await db.insert(spaces).values({
      name: `${adminName}'s workspace`,
      ownerId: adminUser.id,
    }).returning();

    await db.insert(spaceMembers).values({
      spaceId: adminSpace.id,
      userId: adminUser.id,
      role: 'owner',
    });

    console.log(`[Seed] Admin user created: ${adminEmail}`);
    if (!process.env.ADMIN_PASSWORD) {
      console.log(`[Seed] Admin password (auto-generated): ${adminPassword}`);
    }
  } else if (existingAdmin.role !== 'admin') {
    await db.update(users).set({ role: 'admin', updatedAt: new Date() }).where(eq(users.id, existingAdmin.id));
    console.log(`[Seed] Promoted ${adminEmail} to admin role`);
  }
}
