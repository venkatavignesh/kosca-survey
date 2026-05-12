import { prisma } from '@/lib/db';
import { audit, AUDIT_ACTIONS } from '@/lib/audit';
import { ApiError } from '@/lib/errors';

// Locations / OfficeTypes / Departments share the exact same CRUD shape, so we
// parameterise the operations on the Prisma delegate name rather than copy
// three near-identical files.

type MasterKind = 'location' | 'officeType' | 'department';

// The three master delegates expose identical method shapes, but TypeScript
// can't prove that across the discriminated union of Prisma model types, so
// we narrow with `any` here. Misuse would surface immediately in tests.
function delegate(kind: MasterKind): any {
  switch (kind) {
    case 'location':   return prisma.location;
    case 'officeType': return prisma.officeType;
    case 'department': return prisma.department;
  }
}

export async function listMaster(kind: MasterKind) {
  return delegate(kind).findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { employees: true } } },
  });
}

export async function createMaster(
  kind: MasterKind,
  name: string,
  actorId: string,
  actorEmail: string,
) {
  const trimmed = name.trim();
  try {
    const item = await delegate(kind).create({ data: { name: trimmed } });
    await audit({
      action: AUDIT_ACTIONS.MASTER_CREATE,
      userId: actorId,
      actorEmail,
      entityType: kind,
      entityId: item.id,
      metadata: { name: trimmed },
    });
    return item;
  } catch (e: any) {
    if (e?.code === 'P2002') throw new ApiError(409, 'CONFLICT', 'already exists');
    throw e;
  }
}

export async function updateMaster(
  kind: MasterKind,
  id: string,
  name: string,
  actorId: string,
  actorEmail: string,
) {
  const trimmed = name.trim();
  try {
    const item = await delegate(kind).update({ where: { id }, data: { name: trimmed } });
    await audit({
      action: AUDIT_ACTIONS.MASTER_UPDATE,
      userId: actorId,
      actorEmail,
      entityType: kind,
      entityId: id,
      metadata: { name: trimmed },
    });
    return item;
  } catch (e: any) {
    if (e?.code === 'P2002') throw new ApiError(409, 'CONFLICT', 'already exists');
    if (e?.code === 'P2025') throw new ApiError(404, 'NOT_FOUND', 'not found');
    throw e;
  }
}

export async function deleteMaster(
  kind: MasterKind,
  id: string,
  actorId: string,
  actorEmail: string,
) {
  try {
    await delegate(kind).delete({ where: { id } });
    await audit({
      action: AUDIT_ACTIONS.MASTER_DELETE,
      userId: actorId,
      actorEmail,
      entityType: kind,
      entityId: id,
    });
  } catch (e: any) {
    if (e?.code === 'P2025') throw new ApiError(404, 'NOT_FOUND', 'not found');
    if (e?.code === 'P2003') throw new ApiError(409, 'CONFLICT', 'master in use by employees');
    throw e;
  }
}
