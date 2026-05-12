import { PrismaClient, Role } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const DEFAULT_OFFICE_TYPES = ['Branch (Warehouse)', 'HO', 'Technical Centre'];
const DEFAULT_DEPARTMENTS = [
  'BDE / Sales',
  'Accounts',
  'IT',
  'HR',
  'Operations',
];
const DEFAULT_LOCATIONS = ['Chennai'];

async function ensureUser(email: string, password: string, name: string, role: Role) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;
  const passwordHash = await bcrypt.hash(password, 12);
  return prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
      role,
      mustChangePassword: true,
    },
  });
}

async function main() {
  console.log('Seeding...');

  for (const name of DEFAULT_OFFICE_TYPES) {
    await prisma.officeType.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  for (const name of DEFAULT_DEPARTMENTS) {
    await prisma.department.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  for (const name of DEFAULT_LOCATIONS) {
    await prisma.location.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  await ensureUser(
    process.env.ADMIN_EMAIL || 'it@kosca.in',
    process.env.ADMIN_PASSWORD || 'Kosca@124',
    'IT Admin',
    Role.ADMIN,
  );
  await ensureUser(
    process.env.HR_EMAIL || 'hr@kosca.in',
    process.env.HR_PASSWORD || 'Kosca@124',
    'HR',
    Role.HR,
  );

  console.log('Seeded.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
