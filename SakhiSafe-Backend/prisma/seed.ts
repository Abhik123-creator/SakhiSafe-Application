import { PrismaClient, RoleName, OrganizationType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const roles = [RoleName.SUPER_ADMIN, RoleName.SYSTEM_ADMIN, RoleName.NGO_ADMIN, RoleName.NGO_WORKER];

  for (const name of roles) {
    await prisma.role.upsert({
      where: { name },
      create: { name, description: `${name.replaceAll('_', ' ')} role` },
      update: {},
    });
  }

  const organization = await prisma.organization.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'SakhiSafe Sample NGO',
      type: OrganizationType.NGO,
      phone: '+910000000000',
      address: 'Local development address',
    },
    update: {},
  });

  const passwordHash = await bcrypt.hash('Admin@12345', Number(process.env.BCRYPT_SALT_ROUNDS ?? 10));
  const admin = await prisma.user.upsert({
    where: { email: 'admin@sakhisafe.local' },
    create: {
      email: 'admin@sakhisafe.local',
      passwordHash,
      name: 'System Admin',
      organizationId: organization.id,
    },
    update: { passwordHash },
  });

  const superAdminRole = await prisma.role.findUniqueOrThrow({ where: { name: RoleName.SUPER_ADMIN } });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: superAdminRole.id } },
    create: { userId: admin.id, roleId: superAdminRole.id },
    update: {},
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
