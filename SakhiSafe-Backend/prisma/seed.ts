import { ModuleKey, OrganizationType, PermissionAction, PrismaClient, RoleName } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const moduleDefinitions: Record<ModuleKey, { name: string; description: string }> = {
  DASHBOARD: { name: 'Dashboard', description: 'Dashboard overview and metrics' },
  USERS: { name: 'Users', description: 'User account management' },
  ROLES: { name: 'Roles', description: 'Role management' },
  MODULES: { name: 'Modules', description: 'Application module control' },
  ORGANIZATIONS: { name: 'Organizations', description: 'Partner and response organizations' },
  CARE_SEEKERS: { name: 'Care Seekers', description: 'Respectful records for affected people' },
  CASES: { name: 'Cases', description: 'Case management' },
  MESSAGES: { name: 'Messages', description: 'Messaging records' },
  INCIDENTS: { name: 'Incidents', description: 'Incident records' },
  SAFETY_LOGS: { name: 'Safety Logs', description: 'Safety check-ins and logs' },
  EVIDENCE: { name: 'Evidence', description: 'Evidence records' },
  RAG_DOCUMENTS: { name: 'RAG Documents', description: 'Future AI knowledge documents' },
  AUDIT_LOGS: { name: 'Audit Logs', description: 'Security audit trail' },
  SYSTEM_SETTINGS: { name: 'System Settings', description: 'Platform configuration' },
};

type PermissionSeed = Partial<Record<PermissionAction, boolean>>;

const defaultPermissions: Record<Exclude<RoleName, 'SUPER_ADMIN'>, Partial<Record<ModuleKey, PermissionSeed>>> = {
  ADMIN: {
    DASHBOARD: { VIEW: true },
    USERS: { VIEW: true, CREATE: true, UPDATE: true },
    ORGANIZATIONS: { VIEW: true, CREATE: true, UPDATE: true },
    CARE_SEEKERS: { VIEW: true, CREATE: true, UPDATE: true },
    CASES: { VIEW: true, CREATE: true, UPDATE: true, DELETE: true },
    MESSAGES: { VIEW: true, CREATE: true, UPDATE: true },
    INCIDENTS: { VIEW: true, CREATE: true, UPDATE: true },
    SAFETY_LOGS: { VIEW: true, CREATE: true, UPDATE: true },
    EVIDENCE: { VIEW: true, CREATE: true, UPDATE: true },
    RAG_DOCUMENTS: { VIEW: true, CREATE: true, UPDATE: true },
    AUDIT_LOGS: { VIEW: true },
  },
  ORGANIZATION: {
    DASHBOARD: { VIEW: true },
    ORGANIZATIONS: { VIEW: true, UPDATE: true },
    CARE_SEEKERS: { VIEW: true, UPDATE: true },
    CASES: { VIEW: true, UPDATE: true },
    MESSAGES: { VIEW: true, CREATE: true },
    INCIDENTS: { VIEW: true, CREATE: true, UPDATE: true },
    SAFETY_LOGS: { VIEW: true, CREATE: true },
    EVIDENCE: { VIEW: true, CREATE: true },
    RAG_DOCUMENTS: { VIEW: true },
  },
  CARE_SEEKER: {
    DASHBOARD: { VIEW: true },
    CARE_SEEKERS: { VIEW: true, UPDATE: true },
    CASES: { VIEW: true },
    MESSAGES: { VIEW: true, CREATE: true },
    INCIDENTS: { VIEW: true, CREATE: true },
    SAFETY_LOGS: { VIEW: true },
    EVIDENCE: { VIEW: true, CREATE: true },
  },
};

function toPermissionData(seed: PermissionSeed) {
  return {
    canView: seed.VIEW ?? false,
    canCreate: seed.CREATE ?? false,
    canUpdate: seed.UPDATE ?? false,
    canDelete: seed.DELETE ?? false,
  };
}

async function upsertRolePermission(roleId: string, moduleId: string, seed: PermissionSeed) {
  await prisma.rolePermission.upsert({
    where: { roleId_moduleId: { roleId, moduleId } },
    create: { roleId, moduleId, ...toPermissionData(seed) },
    update: toPermissionData(seed),
  });
}

async function main() {
  const roles = Object.values(RoleName);
  const modules = Object.values(ModuleKey);

  for (const name of roles) {
    await prisma.role.upsert({
      where: { name },
      create: { name, description: `${name.replaceAll('_', ' ')} role` },
      update: { description: `${name.replaceAll('_', ' ')} role` },
    });
  }

  for (const key of modules) {
    await prisma.appModule.upsert({
      where: { key },
      create: {
        key,
        name: moduleDefinitions[key].name,
        description: moduleDefinitions[key].description,
        isEnabled: true,
      },
      update: {
        name: moduleDefinitions[key].name,
        description: moduleDefinitions[key].description,
      },
    });
  }

  const allRoles = await prisma.role.findMany();
  const allModules = await prisma.appModule.findMany();
  const roleByName = new Map(allRoles.map((role) => [role.name, role]));
  const moduleByKey = new Map(allModules.map((moduleRecord) => [moduleRecord.key, moduleRecord]));

  const superAdminRole = roleByName.get(RoleName.SUPER_ADMIN);
  if (!superAdminRole) {
    throw new Error('SUPER_ADMIN role was not created');
  }

  for (const moduleRecord of allModules) {
    await upsertRolePermission(superAdminRole.id, moduleRecord.id, {
      VIEW: true,
      CREATE: true,
      UPDATE: true,
      DELETE: true,
    });
  }

  for (const [roleName, permissionMap] of Object.entries(defaultPermissions) as [
    Exclude<RoleName, 'SUPER_ADMIN'>,
    Partial<Record<ModuleKey, PermissionSeed>>,
  ][]) {
    const role = roleByName.get(roleName);
    if (!role) {
      continue;
    }

    for (const [moduleKey, permissions] of Object.entries(permissionMap) as [ModuleKey, PermissionSeed][]) {
      const moduleRecord = moduleByKey.get(moduleKey);
      if (moduleRecord) {
        await upsertRolePermission(role.id, moduleRecord.id, permissions);
      }
    }
  }

  const organization = await prisma.organization.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'SakhiSafe Sample Organization',
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
      fullName: 'System Super Admin',
      organizationId: organization.id,
    },
    update: { passwordHash, fullName: 'System Super Admin' },
  });

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
