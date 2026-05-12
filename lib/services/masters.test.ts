import { describe, it, expect, vi, beforeEach } from 'vitest';

const { location, officeType, department, auditFn } = vi.hoisted(() => {
  const makeDel = () => ({
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  });
  return {
    location: makeDel(),
    officeType: makeDel(),
    department: makeDel(),
    auditFn: vi.fn(),
  };
});

vi.mock('@/lib/db', () => ({
  prisma: { location, officeType, department },
}));
vi.mock('@/lib/audit', () => ({
  audit: auditFn,
  AUDIT_ACTIONS: {
    MASTER_CREATE: 'MASTER_CREATE',
    MASTER_UPDATE: 'MASTER_UPDATE',
    MASTER_DELETE: 'MASTER_DELETE',
  },
}));
vi.mock('next/headers', () => ({ headers: () => ({ get: () => 'req-id' }) }));

import { listMaster, createMaster, updateMaster, deleteMaster } from './masters';

beforeEach(() => {
  for (const d of [location, officeType, department]) {
    d.findMany.mockReset();
    d.create.mockReset();
    d.update.mockReset();
    d.delete.mockReset();
  }
  auditFn.mockReset();
});

describe('listMaster', () => {
  it('orders by name and includes employee count', async () => {
    location.findMany.mockResolvedValueOnce([]);
    await listMaster('location');
    expect(location.findMany.mock.calls[0][0]).toMatchObject({
      orderBy: { name: 'asc' },
      include: { _count: { select: { employees: true } } },
    });
  });
});

describe('createMaster', () => {
  it('trims the name', async () => {
    location.create.mockResolvedValueOnce({ id: 'l1', name: 'Chennai' });
    await createMaster('location', '  Chennai  ', 'u', 'a');
    expect(location.create.mock.calls[0][0].data.name).toBe('Chennai');
  });

  it('routes to the right delegate per kind', async () => {
    officeType.create.mockResolvedValueOnce({ id: 'o1', name: 'HO' });
    await createMaster('officeType', 'HO', 'u', 'a');
    expect(officeType.create).toHaveBeenCalledOnce();
    expect(location.create).not.toHaveBeenCalled();
  });

  it('throws 409 on duplicate', async () => {
    department.create.mockRejectedValueOnce({ code: 'P2002' });
    await expect(createMaster('department', 'HR', 'u', 'a')).rejects.toMatchObject({
      status: 409,
      code: 'CONFLICT',
    });
  });

  it('audits with the master kind as entityType', async () => {
    location.create.mockResolvedValueOnce({ id: 'l1', name: 'X' });
    await createMaster('location', 'X', 'u', 'a');
    expect(auditFn).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: 'location', entityId: 'l1' }),
    );
  });
});

describe('updateMaster', () => {
  it('returns the updated item', async () => {
    location.update.mockResolvedValueOnce({ id: 'l1', name: 'New' });
    const r = await updateMaster('location', 'l1', 'New', 'u', 'a');
    expect(r.name).toBe('New');
  });

  it('throws 404 on missing', async () => {
    location.update.mockRejectedValueOnce({ code: 'P2025' });
    await expect(updateMaster('location', 'l1', 'x', 'u', 'a')).rejects.toMatchObject({
      status: 404,
    });
  });

  it('throws 409 on duplicate name', async () => {
    location.update.mockRejectedValueOnce({ code: 'P2002' });
    await expect(updateMaster('location', 'l1', 'x', 'u', 'a')).rejects.toMatchObject({
      status: 409,
    });
  });
});

describe('deleteMaster', () => {
  it('throws 404 on missing', async () => {
    location.delete.mockRejectedValueOnce({ code: 'P2025' });
    await expect(deleteMaster('location', 'l1', 'u', 'a')).rejects.toMatchObject({
      status: 404,
    });
  });

  it('translates FK violation P2003 to 409', async () => {
    location.delete.mockRejectedValueOnce({ code: 'P2003' });
    await expect(deleteMaster('location', 'l1', 'u', 'a')).rejects.toMatchObject({
      status: 409,
    });
  });

  it('audits the delete on success', async () => {
    location.delete.mockResolvedValueOnce({});
    await deleteMaster('location', 'l1', 'u', 'a');
    expect(auditFn).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'MASTER_DELETE', entityId: 'l1' }),
    );
  });
});
