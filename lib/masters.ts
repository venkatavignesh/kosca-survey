import { prisma } from './db';

export type MasterKind = 'location' | 'officeType' | 'department';

export const masterDelegates = {
  location: prisma.location,
  officeType: prisma.officeType,
  department: prisma.department,
} as const;

export const masterLabels: Record<MasterKind, string> = {
  location: 'Location',
  officeType: 'Office type',
  department: 'Department',
};
