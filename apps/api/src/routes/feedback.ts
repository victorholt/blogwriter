import { Router } from 'express';
import { db } from '../db';
import { feedbackForms, feedbackResponses, appSettings, users } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { optionalAuth } from '../middleware/auth';
import { sendEmail } from '../services/email';

const router = Router();

async function isFeedbackEnabled(): Promise<boolean> {
  try {
    const row = await db.select().from(appSettings).where(eq(appSettings.key, 'feedback_enabled')).limit(1);
    return row[0]?.value === 'true';
  } catch {
    return false;
  }
}

async function isFeedbackAgentEnabled(): Promise<boolean> {
  try {
    const row = await db.select().from(appSettings).where(eq(appSettings.key, 'feedback_agent_enabled')).limit(1);
    return row[0]?.value === 'true';
  } catch {
    return false;
  }
}

async function isFeedbackWidgetEnabled(): Promise<boolean> {
  try {
    const row = await db.select().from(appSettings).where(eq(appSettings.key, 'feedback_widget_enabled')).limit(1);
    return row[0]?.value === 'true';
  } catch {
    return false;
  }
}

// GET /api/feedback/active — returns the active/default form definition
// Accepts ?context=widget to also gate on feedback_widget_enabled
router.get('/active', async (req, res) => {
  try {
    if (!(await isFeedbackEnabled())) {
      return res.status(404).json({ success: false, error: 'Feedback is currently unavailable' });
    }

    // Widget context: also check widget toggle
    if (req.query.context === 'widget' && !(await isFeedbackWidgetEnabled())) {
      return res.status(404).json({ success: false, error: 'Feedback widget is disabled' });
    }

    // Prefer default form, fallback to first active
    let [form] = await db.select().from(feedbackForms)
      .where(and(eq(feedbackForms.isDefault, true), eq(feedbackForms.isActive, true)))
      .limit(1);

    if (!form) {
      [form] = await db.select().from(feedbackForms).where(eq(feedbackForms.isActive, true)).limit(1);
    }

    if (!form) {
      return res.status(404).json({ success: false, error: 'No active feedback form found' });
    }

    return res.json({
      success: true,
      data: {
        id: form.id,
        slug: form.slug,
        name: form.name,
        description: form.description,
        type: form.type,
        questions: JSON.parse(form.questions),
      },
    });
  } catch (err) {
    console.error('[Feedback] Error fetching active form:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch feedback form' });
  }
});

// POST /api/feedback — submit a response (optional auth: works for guests too)
router.post('/', optionalAuth, async (req, res) => {
  try {
    if (!(await isFeedbackEnabled())) {
      return res.status(503).json({ success: false, error: 'Feedback is currently unavailable' });
    }

    const { formSlug, answers } = req.body;
    if (!formSlug || typeof answers !== 'object' || answers === null) {
      return res.status(400).json({ success: false, error: 'formSlug and answers are required' });
    }

    // Get the form to validate required fields
    const [form] = await db.select().from(feedbackForms).where(eq(feedbackForms.slug, formSlug)).limit(1);
    if (!form) {
      return res.status(404).json({ success: false, error: 'Feedback form not found' });
    }

    let questions: Array<{ id: string; required: boolean }> = [];
    try {
      questions = JSON.parse(form.questions);
    } catch {
      // ignore parse errors
    }

    const missing = questions.filter((q) => q.required && !answers[q.id]);
    if (missing.length > 0) {
      return res.status(400).json({ success: false, error: `Required fields missing: ${missing.map((q) => q.id).join(', ')}` });
    }

    // Get user info from session if authenticated
    let userId: string | undefined;
    let storeCode: string | undefined;

    if (req.user) {
      userId = req.user.id;
      // Fetch store code from DB
      try {
        const [userRow] = await db.select({ storeCode: users.storeCode }).from(users).where(eq(users.id, req.user.id)).limit(1);
        storeCode = userRow?.storeCode ?? undefined;
      } catch { /* ignore */ }
    }

    const [response] = await db.insert(feedbackResponses).values({
      formId: form.id,
      formSlug: form.slug,
      userId: userId ?? null,
      storeCode: storeCode ?? null,
      answers: JSON.stringify(answers),
      status: 'new',
    }).returning();

    // Fire-and-forget: run review agent if enabled
    if (await isFeedbackAgentEnabled()) {
      runFeedbackReview(response.id, form.questions, answers).catch(() => {});
    }

    // Fire-and-forget: send admin notification
    sendAdminNotification(form.name, storeCode, answers).catch(() => {});

    return res.json({ success: true, data: { id: response.id } });
  } catch (err) {
    console.error('[Feedback] Error submitting feedback:', err);
    return res.status(500).json({ success: false, error: 'Failed to submit feedback' });
  }
});

async function runFeedbackReview(responseId: string, questionsJson: string, answers: Record<string, string>): Promise<void> {
  try {
    const { reviewFeedback } = await import('../mastra/agents/feedback-reviewer');
    const review = await reviewFeedback(questionsJson, answers);
    await db.update(feedbackResponses)
      .set({ agentReview: JSON.stringify(review), agentReviewedAt: new Date(), updatedAt: new Date() })
      .where(eq(feedbackResponses.id, responseId));
  } catch (err) {
    console.error('[Feedback] Review agent error:', err);
  }
}

async function sendAdminNotification(formName: string, storeCode: string | undefined, answers: Record<string, string>): Promise<void> {
  try {
    const settings = await db.select().from(appSettings);
    const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));
    const adminEmail = map.smtp_from_email;
    if (!adminEmail) return;

    const answersText = Object.entries(answers)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');

    await sendEmail(
      adminEmail,
      `New Feedback — ${formName}${storeCode ? ` (${storeCode})` : ''}`,
      `<p><strong>New pilot feedback received.</strong></p><p>Store Code: ${storeCode || 'N/A'}</p><pre>${answersText}</pre>`,
      `New pilot feedback received.\nStore Code: ${storeCode || 'N/A'}\n\n${answersText}`,
    );
  } catch { /* ignore */ }
}

export default router;
