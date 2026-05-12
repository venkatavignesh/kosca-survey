import { prisma } from './db';
import { logger } from './logger';
import { auditWritesTotal } from './metrics';
import { headers } from 'next/headers';

// Standard action codes. Audit consumers (admin UI, exports) should filter by
// these enum values, never by raw strings. Add new actions here as you create
// them so the action surface stays inspectable.
export const AUDIT_ACTIONS = {
  CAMPAIGN_CREATE: 'CAMPAIGN_CREATE',
  CAMPAIGN_UPDATE: 'CAMPAIGN_UPDATE',
  CAMPAIGN_DELETE: 'CAMPAIGN_DELETE',
  CAMPAIGN_SEND: 'CAMPAIGN_SEND',
  CAMPAIGN_ASSIGN: 'CAMPAIGN_ASSIGN',
  CAMPAIGN_QUESTIONS_UPDATE: 'CAMPAIGN_QUESTIONS_UPDATE',
  CAMPAIGN_GROUP_CREATE: 'CAMPAIGN_GROUP_CREATE',
  CAMPAIGN_GROUP_UPDATE: 'CAMPAIGN_GROUP_UPDATE',
  CAMPAIGN_GROUP_DELETE: 'CAMPAIGN_GROUP_DELETE',
  EMPLOYEE_CREATE: 'EMPLOYEE_CREATE',
  EMPLOYEE_UPDATE: 'EMPLOYEE_UPDATE',
  EMPLOYEE_DELETE: 'EMPLOYEE_DELETE',
  EMPLOYEE_IMPORT: 'EMPLOYEE_IMPORT',
  QUESTION_CREATE: 'QUESTION_CREATE',
  QUESTION_UPDATE: 'QUESTION_UPDATE',
  QUESTION_DELETE: 'QUESTION_DELETE',
  USER_CREATE: 'USER_CREATE',
  USER_UPDATE: 'USER_UPDATE',
  USER_DELETE: 'USER_DELETE',
  USER_LOGIN: 'USER_LOGIN',
  USER_PASSWORD_CHANGE: 'USER_PASSWORD_CHANGE',
  MASTER_CREATE: 'MASTER_CREATE',
  MASTER_UPDATE: 'MASTER_UPDATE',
  MASTER_DELETE: 'MASTER_DELETE',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export type AuditInput = {
  action: AuditAction;
  userId?: string | null;
  actorEmail?: string | null;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
};

// Best-effort: never throw from inside an audit write. If the audit log is
// down we still want the request to succeed; the failure goes to the logger
// for after-the-fact reconciliation.
export async function audit(input: AuditInput): Promise<void> {
  try {
    const h = await headers();
    const requestId = h.get('x-request-id') || undefined;
    const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || undefined;
    await prisma.auditLog.create({
      data: {
        action: input.action,
        userId: input.userId ?? null,
        actorEmail: input.actorEmail ?? null,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata as any,
        requestId,
        ip,
      },
    });
    auditWritesTotal.inc({ action: input.action });
  } catch (err) {
    logger.warn({ err, action: input.action }, 'audit log write failed');
  }
}
