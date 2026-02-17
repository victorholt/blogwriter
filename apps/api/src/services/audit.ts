import { db } from '../db';
import { auditLogs } from '../db/schema';
import type { Request } from 'express';

interface AuditParams {
  userId?: string | null;
  spaceId?: string | null;
  action: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  req?: Request;
}

export function logAudit(params: AuditParams): void {
  // Fire and forget — never block the request
  db.insert(auditLogs).values({
    userId: params.userId ?? null,
    spaceId: params.spaceId ?? null,
    action: params.action,
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    ipAddress: params.req?.ip ?? params.req?.headers['x-forwarded-for']?.toString() ?? null,
    userAgent: params.req?.headers['user-agent'] ?? null,
  }).catch((err) => {
    console.error('[Audit] Failed to log:', err);
  });
}
