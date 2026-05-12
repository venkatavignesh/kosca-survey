import { prisma } from '@/lib/db';
import { UsersClient } from './ui';

export default async function UsersPage() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, email: true, name: true, role: true,
      mustChangePassword: true, passwordChangedAt: true, createdAt: true,
    },
  });
  return <UsersClient users={users.map(u => ({
    ...u,
    createdAt: u.createdAt.toISOString(),
    passwordChangedAt: u.passwordChangedAt?.toISOString() ?? null,
  }))} />;
}
