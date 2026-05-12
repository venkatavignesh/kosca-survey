// Centralised string constants. Avoid stringly-typed action codes, statuses,
// and enum values scattered across the codebase — change one source of truth
// here instead.

export { AUDIT_ACTIONS, type AuditAction } from './audit';

// Mirrors Prisma's CampaignStatus enum (keep in sync with schema.prisma).
export const CAMPAIGN_STATUS = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  CLOSED: 'CLOSED',
} as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUS)[keyof typeof CAMPAIGN_STATUS];

// Mirrors Prisma's Role enum.
export const ROLES = {
  ADMIN: 'ADMIN',
  HR: 'HR',
} as const;
export type Role = (typeof ROLES)[keyof typeof ROLES];

// Mirrors Prisma's Audience enum on CampaignQuestion.
export const AUDIENCES = {
  ALL: 'ALL',
  SPECIFIC: 'SPECIFIC',
} as const;
export type Audience = (typeof AUDIENCES)[keyof typeof AUDIENCES];

// Mirrors Prisma's QuestionType enum.
export const QUESTION_TYPES = {
  RADIO: 'RADIO',
  CHECKBOX: 'CHECKBOX',
  MCQ_SINGLE: 'MCQ_SINGLE',
  MCQ_MULTI: 'MCQ_MULTI',
  TEXT: 'TEXT',
  LONG_TEXT: 'LONG_TEXT',
} as const;
export type QuestionType = (typeof QUESTION_TYPES)[keyof typeof QUESTION_TYPES];

export const TEXT_QUESTION_TYPES: ReadonlySet<QuestionType> = new Set([
  QUESTION_TYPES.TEXT,
  QUESTION_TYPES.LONG_TEXT,
]);
