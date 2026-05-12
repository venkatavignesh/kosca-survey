import { prisma } from '@/lib/db';
import { audit, AUDIT_ACTIONS } from '@/lib/audit';
import { ApiError } from '@/lib/errors';

export type CreateEmployeeInput = {
  empCode: string;
  name: string;
  email: string;
  designation: string;
  locationId: string;
  officeTypeId: string;
  departmentId: string;
  actorId: string;
  actorEmail: string;
};

export async function createEmployee(input: CreateEmployeeInput) {
  try {
    const e = await prisma.employee.create({
      data: {
        empCode: input.empCode.trim(),
        name: input.name,
        email: input.email.toLowerCase().trim(),
        designation: input.designation,
        locationId: input.locationId,
        officeTypeId: input.officeTypeId,
        departmentId: input.departmentId,
      },
    });
    await audit({
      action: AUDIT_ACTIONS.EMPLOYEE_CREATE,
      userId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: 'Employee',
      entityId: e.id,
      metadata: { empCode: e.empCode, name: e.name },
    });
    return e;
  } catch (e: any) {
    if (e?.code === 'P2002') throw new ApiError(409, 'CONFLICT', 'empCode already exists');
    throw e;
  }
}
