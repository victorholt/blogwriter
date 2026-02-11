import { db } from '../db';
import { agentLogs, appSettings } from '../db/schema';
import { eq } from 'drizzle-orm';

// In-memory cache for insights_enabled setting
let insightsEnabledCache: { value: boolean; fetchedAt: number } | null = null;
const CACHE_TTL = 60_000; // 60 seconds

export async function isInsightsEnabled(): Promise<boolean> {
  if (insightsEnabledCache && Date.now() - insightsEnabledCache.fetchedAt < CACHE_TTL) {
    return insightsEnabledCache.value;
  }

  try {
    const setting = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, 'insights_enabled'))
      .limit(1);

    const enabled = setting[0]?.value !== 'false';
    insightsEnabledCache = { value: enabled, fetchedAt: Date.now() };
    return enabled;
  } catch (err) {
    console.error('[AgentTrace] Error checking insights_enabled:', err);
    return true; // Default to enabled on error
  }
}

export function invalidateInsightsCache(): void {
  insightsEnabledCache = null;
}

export async function startTrace(agentId: string, sessionId?: string): Promise<string> {
  const traceId = crypto.randomUUID();

  // Log an initial entry to establish the trace
  log(traceId, sessionId ?? null, agentId, 'agent-input', { started: true });

  return traceId;
}

export function log(
  traceId: string,
  sessionId: string | null,
  agentId: string,
  eventType: string,
  data: unknown,
): void {
  // Fire-and-forget — never blocks the caller
  db.insert(agentLogs)
    .values({
      traceId,
      sessionId,
      agentId,
      eventType,
      data: JSON.stringify(data),
    })
    .catch((err) => {
      console.error('[AgentTrace] Failed to write log:', err);
    });
}

export async function getTrace(traceId: string) {
  const logs = await db
    .select()
    .from(agentLogs)
    .where(eq(agentLogs.traceId, traceId))
    .orderBy(agentLogs.createdAt);

  return logs.map(formatLogEntry);
}

export async function getSessionTraces(sessionId: string) {
  const logs = await db
    .select()
    .from(agentLogs)
    .where(eq(agentLogs.sessionId, sessionId))
    .orderBy(agentLogs.createdAt);

  return logs.map(formatLogEntry);
}

function formatLogEntry(row: typeof agentLogs.$inferSelect) {
  return {
    id: row.id,
    traceId: row.traceId,
    sessionId: row.sessionId,
    agentId: row.agentId,
    eventType: row.eventType,
    data: JSON.parse(row.data),
    createdAt: row.createdAt.toISOString(),
  };
}
