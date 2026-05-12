import { describe, it, expect, vi, beforeEach } from 'vitest';

const { empDel, auditFn } = vi.hoisted(() => ({
  empDel: { create: vi.fn() },
  auditFn: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ prisma: { employee: empDel } }));
vi.mock('@/lib/audit', () => ({
  audit: auditFn,
  AUDIT_ACTIONS: { EMPLOYEE_CREATE: 'EMPLOYEE_CREATE' },
}));
vi.mock('next/headers', () => ({ headers: () => ({ get: () => 'req-id' }) }));

import { createEmployee } from './employees';

beforeEach(() => {
  empDel.create.mockReset();
  auditFn.mockReset();
});

describe('createEmployee', () => {
  it('lowercases + trims email and empCode', async () => {
    empDel.create.mockResolvedValueOnce({ id: 'e1', empCode: 'E1', name: 'X' });
    await createEmployee({
      empCode: '  E1 ',
      name: 'X',
      email: '  X@Y.COM ',
      designation: 'Dev',
      locationId: 'l',
      officeTypeId: 'o',
      departmentId: 'd',
      actorId: 'u',
      actorEmail: 'a',
    });
    const args = empDel.create.mock.calls[0][0];
    expect(args.data.email).toBe('x@y.com');
    expect(args.data.empCode).toBe('E1');
  });

  it('audits the create', async () => {
    empDel.create.mockResolvedValueOnce({ id: 'e1', empCode: 'E1', name: 'X' });
    await createEmployee({
      empCode: 'E1', name: 'X', email: 'x@y.com', designation: 'D',
      locationId: 'l', officeTypeId: 'o', departmentId: 'd',
      actorId: 'u', actorEmail: 'a',
    });
    expect(auditFn).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'EMPLOYEE_CREATE', entityId: 'e1' }),
    );
  });

  it('maps P2002 to a 409 ApiError', async () => {
    empDel.create.mockRejectedValueOnce({ code: 'P2002' });
    await expect(
      createEmployee({
        empCode: 'dup', name: 'X', email: 'x@y.com', designation: 'D',
        locationId: 'l', officeTypeId: 'o', departmentId: 'd',
        actorId: 'u', actorEmail: 'a',
      }),
    ).rejects.toMatchObject({ status: 409, code: 'CONFLICT' });
  });
});
