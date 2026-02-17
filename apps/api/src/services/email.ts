import nodemailer from 'nodemailer';
import { db } from '../db';
import { appSettings } from '../db/schema';
import { inArray } from 'drizzle-orm';

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  fromEmail: string;
  fromName: string;
  secure: boolean;
}

async function getSmtpConfig(): Promise<SmtpConfig | null> {
  const keys = ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_password', 'smtp_from_email', 'smtp_from_name', 'smtp_secure'];
  const rows = await db.select().from(appSettings).where(inArray(appSettings.key, keys));
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  if (!map.smtp_host || !map.smtp_user || !map.smtp_password) {
    return null;
  }

  return {
    host: map.smtp_host,
    port: parseInt(map.smtp_port || '587'),
    user: map.smtp_user,
    password: map.smtp_password,
    fromEmail: map.smtp_from_email || map.smtp_user,
    fromName: map.smtp_from_name || 'BlogWriter',
    secure: map.smtp_secure !== 'false',
  };
}

function createTransporter(config: SmtpConfig): nodemailer.Transporter {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.password,
    },
  });
}

export async function sendPasswordResetEmail(toEmail: string, resetToken: string): Promise<boolean> {
  const config = await getSmtpConfig();
  if (!config) {
    console.warn('[Email] SMTP not configured, skipping password reset email');
    return false;
  }

  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:3000';
  const resetUrl = `${appUrl}/reset-password?token=${resetToken}`;

  try {
    const transporter = createTransporter(config);
    await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to: toEmail,
      subject: 'Reset your BlogWriter password',
      text: `You requested a password reset. Click this link to set a new password:\n\n${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, you can ignore this email.`,
      html: `
        <p>You requested a password reset.</p>
        <p><a href="${resetUrl}">Click here to set a new password</a></p>
        <p>This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>
      `,
    });
    return true;
  } catch (err) {
    console.error('[Email] Failed to send password reset email:', err);
    return false;
  }
}

export async function sendBlogSharedNotification(toEmail: string, fromName: string, blogTitle: string): Promise<boolean> {
  const config = await getSmtpConfig();
  if (!config) return false;

  try {
    const transporter = createTransporter(config);
    await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to: toEmail,
      subject: `${fromName} shared a blog with you`,
      text: `${fromName} shared the blog "${blogTitle}" with you. Log in to BlogWriter to view it.`,
      html: `<p><strong>${fromName}</strong> shared the blog "<em>${blogTitle}</em>" with you.</p><p>Log in to BlogWriter to view it.</p>`,
    });
    return true;
  } catch (err) {
    console.error('[Email] Failed to send blog shared notification:', err);
    return false;
  }
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
