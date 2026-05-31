import { Injectable } from '@nestjs/common';
import { ModuleKey } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RolePermissionItemDto } from '../dto/update-role-permissions.dto';

@Injectable()
export class PermissionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByRole(roleId: string) {
    return this.prisma.rolePermission.findMany({
      where: { roleId },
      include: { module: true },
      orderBy: { module: { key: 'asc' } },
    });
  }

  async replaceRolePermissions(roleId: string, permissions: RolePermissionItemDto[]) {
    return this.prisma.$transaction(async (tx) => {
      for (const permission of permissions) {
        const moduleRecord = await tx.appModule.findUniqueOrThrow({
          where: { key: permission.moduleKey as ModuleKey },
        });
        await tx.rolePermission.upsert({
          where: { roleId_moduleId: { roleId, moduleId: moduleRecord.id } },
          create: {
            roleId,
            moduleId: moduleRecord.id,
            canView: permission.canView,
            canCreate: permission.canCreate,
            canUpdate: permission.canUpdate,
            canDelete: permission.canDelete,
          },
          update: {
            canView: permission.canView,
            canCreate: permission.canCreate,
            canUpdate: permission.canUpdate,
            canDelete: permission.canDelete,
          },
        });
      }

      return tx.rolePermission.findMany({
        where: { roleId },
        include: { module: true },
        orderBy: { module: { key: 'asc' } },
      });
    });
  }
}
