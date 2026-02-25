/**
 * Email template registry — defines all email templates with shared layout.
 *
 * Each template has a subject, HTML body, and plain-text body, all generated
 * from a vars object.  The `sampleVars` on each template are used for admin
 * previews and test sends.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmailTemplate {
  id: string;
  name: string;
  description: string;
  subjectFn: (vars: Record<string, string>) => string;
  htmlFn: (vars: Record<string, string>) => string;
  textFn: (vars: Record<string, string>) => string;
  sampleVars: Record<string, string>;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export interface TemplateListItem {
  id: string;
  name: string;
  description: string;
}

export interface TemplatePreview extends TemplateListItem {
  subject: string;
  html: string;
}

// ---------------------------------------------------------------------------
// Shared HTML layout
// ---------------------------------------------------------------------------

function wrapInLayout(appName: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr><td style="padding:28px 32px 20px;background:#1a1a2e;text-align:center;">
          <span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">${appName}</span>
        </td></tr>
        <!-- Content -->
        <tr><td style="padding:32px 32px 28px;color:#333;font-size:15px;line-height:1.6;">
          ${content}
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:20px 32px;background:#fafafa;border-top:1px solid #eee;text-align:center;font-size:12px;color:#999;">
          Sent by ${appName}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Template definitions
// ---------------------------------------------------------------------------

const SAMPLE_APP_NAME = 'BrideWrite';
const SAMPLE_APP_URL = 'https://app.example.com';

const welcome: EmailTemplate = {
  id: 'welcome',
  name: 'Welcome',
  description: 'Sent to new users after registration.',
  sampleVars: { appName: SAMPLE_APP_NAME, displayName: 'Jane', appUrl: SAMPLE_APP_URL },

  subjectFn: (v) => `Welcome to ${v.appName}!`,

  htmlFn: (v) => wrapInLayout(v.appName, `
    <p style="margin:0 0 16px;font-size:17px;font-weight:600;">Welcome, ${v.displayName}!</p>
    <p style="margin:0 0 16px;">Your account has been created. You can now log in and start creating blog posts.</p>
    <p style="margin:0 0 24px;text-align:center;">
      <a href="${v.appUrl}" style="display:inline-block;padding:12px 28px;background:#1a1a2e;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">Get Started</a>
    </p>
    <p style="margin:0;font-size:13px;color:#888;">If you didn't create this account, you can ignore this email.</p>
  `),

  textFn: (v) =>
    `Welcome, ${v.displayName}!\n\nYour account on ${v.appName} has been created. Log in at ${v.appUrl} to get started.\n\nIf you didn't create this account, you can ignore this email.`,
};

const passwordReset: EmailTemplate = {
  id: 'password-reset',
  name: 'Password Reset',
  description: 'Sent when a user requests a password reset.',
  sampleVars: { appName: SAMPLE_APP_NAME, resetUrl: `${SAMPLE_APP_URL}/reset-password?token=sample-token` },

  subjectFn: (v) => `Reset your ${v.appName} password`,

  htmlFn: (v) => wrapInLayout(v.appName, `
    <p style="margin:0 0 16px;">You requested a password reset. Click the button below to set a new password.</p>
    <p style="margin:0 0 24px;text-align:center;">
      <a href="${v.resetUrl}" style="display:inline-block;padding:12px 28px;background:#1a1a2e;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">Reset Password</a>
    </p>
    <p style="margin:0 0 8px;font-size:13px;color:#888;">This link expires in 1 hour.</p>
    <p style="margin:0;font-size:13px;color:#888;">If you didn't request this, you can safely ignore this email.</p>
  `),

  textFn: (v) =>
    `You requested a password reset.\n\nClick this link to set a new password:\n${v.resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, you can ignore this email.`,
};

const passwordChanged: EmailTemplate = {
  id: 'password-changed',
  name: 'Password Changed',
  description: 'Sent after a password is successfully changed.',
  sampleVars: { appName: SAMPLE_APP_NAME },

  subjectFn: (v) => `Your ${v.appName} password was changed`,

  htmlFn: (v) => wrapInLayout(v.appName, `
    <p style="margin:0 0 16px;">Your password has been successfully changed.</p>
    <p style="margin:0;font-size:13px;color:#888;">If you didn't make this change, please contact us immediately.</p>
  `),

  textFn: (v) =>
    `Your password on ${v.appName} has been successfully changed.\n\nIf you didn't make this change, please contact us immediately.`,
};

const blogShared: EmailTemplate = {
  id: 'blog-shared',
  name: 'Blog Shared',
  description: 'Sent when someone shares a blog post with a user.',
  sampleVars: { appName: SAMPLE_APP_NAME, fromName: 'Alice', blogTitle: 'Top 10 Wedding Dress Trends', appUrl: SAMPLE_APP_URL },

  subjectFn: (v) => `${v.fromName} shared a blog with you`,

  htmlFn: (v) => wrapInLayout(v.appName, `
    <p style="margin:0 0 16px;"><strong>${v.fromName}</strong> shared the blog &ldquo;<em>${v.blogTitle}</em>&rdquo; with you.</p>
    <p style="margin:0 0 24px;text-align:center;">
      <a href="${v.appUrl}" style="display:inline-block;padding:12px 28px;background:#1a1a2e;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">View Blog</a>
    </p>
    <p style="margin:0;font-size:13px;color:#888;">Log in to ${v.appName} to view and edit it.</p>
  `),

  textFn: (v) =>
    `${v.fromName} shared the blog "${v.blogTitle}" with you.\n\nLog in to ${v.appName} at ${v.appUrl} to view it.`,
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const EMAIL_TEMPLATES: Record<string, EmailTemplate> = {
  welcome,
  'password-reset': passwordReset,
  'password-changed': passwordChanged,
  'blog-shared': blogShared,
};

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/** Render a template with the given variable overrides. */
export function renderTemplate(id: string, vars: Record<string, string>): RenderedEmail | null {
  const tpl = EMAIL_TEMPLATES[id];
  if (!tpl) return null;
  return {
    subject: tpl.subjectFn(vars),
    html: tpl.htmlFn(vars),
    text: tpl.textFn(vars),
  };
}

/** Get list of template metadata (no rendered content). */
export function getTemplateList(): TemplateListItem[] {
  return Object.values(EMAIL_TEMPLATES).map(({ id, name, description }) => ({ id, name, description }));
}

/** Render a template with its sample data for admin preview. */
export function renderPreview(id: string): TemplatePreview | null {
  const tpl = EMAIL_TEMPLATES[id];
  if (!tpl) return null;
  return {
    id: tpl.id,
    name: tpl.name,
    description: tpl.description,
    subject: tpl.subjectFn(tpl.sampleVars),
    html: tpl.htmlFn(tpl.sampleVars),
  };
}

/** Render all templates with sample data for the admin listing. */
export function renderAllPreviews(): TemplatePreview[] {
  return Object.values(EMAIL_TEMPLATES).map((tpl) => ({
    id: tpl.id,
    name: tpl.name,
    description: tpl.description,
    subject: tpl.subjectFn(tpl.sampleVars),
    html: tpl.htmlFn(tpl.sampleVars),
  }));
}
