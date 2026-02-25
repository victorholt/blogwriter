import nodemailer from 'nodemailer';
import { db } from '../db';
import { appSettings } from '../db/schema';
import { inArray } from 'drizzle-orm';
import { renderTemplate, EMAIL_TEMPLATES } from './email-templates';

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  fromEmail: string;
  fromName: string;
  encryption: 'none' | 'ssl' | 'tls';
  autoTls: boolean;
  auth: boolean;
}

async function getSmtpConfig(): Promise<SmtpConfig | null> {
  const keys = [
    'smtp_host', 'smtp_port', 'smtp_user', 'smtp_password',
    'smtp_from_email', 'smtp_from_name',
    'smtp_encryption', 'smtp_auto_tls', 'smtp_auth',
    'smtp_secure', // legacy fallback
  ];
  const rows = await db.select().from(appSettings).where(inArray(appSettings.key, keys));
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  if (!map.smtp_host) {
    return null;
  }

  // Migrate legacy smtp_secure → encryption
  let encryption: 'none' | 'ssl' | 'tls' = 'none';
  if (map.smtp_encryption && ['none', 'ssl', 'tls'].includes(map.smtp_encryption)) {
    encryption = map.smtp_encryption as 'none' | 'ssl' | 'tls';
  } else if (map.smtp_secure === 'true') {
    encryption = 'ssl';
  }

  const auth = map.smtp_auth !== 'false';

  return {
    host: map.smtp_host,
    port: parseInt(map.smtp_port || '587'),
    user: map.smtp_user || '',
    password: map.smtp_password || '',
    fromEmail: map.smtp_from_email || map.smtp_user || '',
    fromName: map.smtp_from_name || 'BlogWriter',
    encryption,
    autoTls: map.smtp_auto_tls !== 'false',
    auth,
  };
}

function createTransporter(config: SmtpConfig): nodemailer.Transporter {
  const options: Record<string, unknown> = {
    host: config.host,
    port: config.port,
  };

  switch (config.encryption) {
    case 'ssl':
      options.secure = true;
      break;
    case 'tls':
      options.secure = false;
      options.requireTLS = true;
      break;
    case 'none':
    default:
      options.secure = false;
      if (!config.autoTls) {
        options.ignoreTLS = true;
      }
      break;
  }

  if (config.auth && config.user && config.password) {
    options.auth = { user: config.user, pass: config.password };
  }

  // Accept self-signed certificates (needed for local / internal SMTP servers)
  options.tls = { rejectUnauthorized: false };

  return nodemailer.createTransport(options);
}

// ---------------------------------------------------------------------------
// Helper to resolve runtime vars (appUrl, appName)
// ---------------------------------------------------------------------------

function getAppUrl(): string {
  return process.env.APP_URL || process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:3000';
}

async function getAppName(): Promise<string> {
  const rows = await db.select().from(appSettings).where(inArray(appSettings.key, ['app_name']));
  return rows[0]?.value || 'BrideWrite';
}

// ---------------------------------------------------------------------------
// Send helpers
// ---------------------------------------------------------------------------

async function sendEmail(
  toEmail: string,
  subject: string,
  html: string,
  text: string,
): Promise<boolean> {
  const config = await getSmtpConfig();
  if (!config) {
    console.warn('[Email] SMTP not configured, skipping email');
    return false;
  }

  try {
    const transporter = createTransporter(config);
    await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to: toEmail,
      subject,
      text,
      html,
    });
    return true;
  } catch (err) {
    console.error('[Email] Failed to send email:', err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Public send functions
// ---------------------------------------------------------------------------

export async function sendPasswordResetEmail(toEmail: string, resetToken: string): Promise<boolean> {
  const appUrl = getAppUrl();
  const appName = await getAppName();
  const resetUrl = `${appUrl}/reset-password?token=${resetToken}`;

  const rendered = renderTemplate('password-reset', { appName, resetUrl });
  if (!rendered) return false;

  return sendEmail(toEmail, rendered.subject, rendered.html, rendered.text);
}

export async function sendBlogSharedNotification(toEmail: string, fromName: string, blogTitle: string): Promise<boolean> {
  const appUrl = getAppUrl();
  const appName = await getAppName();

  const rendered = renderTemplate('blog-shared', { appName, fromName, blogTitle, appUrl });
  if (!rendered) return false;

  return sendEmail(toEmail, rendered.subject, rendered.html, rendered.text);
}

export async function sendWelcomeEmail(toEmail: string, displayName: string): Promise<boolean> {
  const appUrl = getAppUrl();
  const appName = await getAppName();

  const rendered = renderTemplate('welcome', { appName, displayName, appUrl });
  if (!rendered) return false;

  return sendEmail(toEmail, rendered.subject, rendered.html, rendered.text);
}

export async function sendPasswordChangedEmail(toEmail: string): Promise<boolean> {
  const appName = await getAppName();

  const rendered = renderTemplate('password-changed', { appName });
  if (!rendered) return false;

  return sendEmail(toEmail, rendered.subject, rendered.html, rendered.text);
}

/** Send any template by ID with the given vars — used by the admin test endpoint. */
export async function sendTemplateEmail(toEmail: string, templateId: string, vars?: Record<string, string>): Promise<boolean> {
  const tpl = EMAIL_TEMPLATES[templateId];
  if (!tpl) return false;

  const appName = await getAppName();
  const appUrl = getAppUrl();
  const merged = { appName, appUrl, ...tpl.sampleVars, ...vars };
  const rendered = renderTemplate(templateId, merged);
  if (!rendered) return false;

  return sendEmail(toEmail, rendered.subject, rendered.html, rendered.text);
}

export async function testSmtpConnection(): Promise<{ success: boolean; error?: string }> {
  const config = await getSmtpConfig();
  if (!config) {
    return { success: false, error: 'SMTP not configured' };
  }

  try {
    const transporter = createTransporter(config);
    await transporter.verify();
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Connection failed' };
  }
}
