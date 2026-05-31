import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionAction, RoleName } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { REQUIRE_PERMISSION_KEY, RequiredPermission } from '../decorators/require-permission.decorator';
import { extractRoleNames } from '../utils/extract-role-names.util';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    if (isPublic === true) {
      return true;
    }

    const requiredPermission = this.reflector.getAllAndOverride<RequiredPermission>(REQUIRE_PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermission) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const roleNames = extractRoleNames(user);

    if (!user || !roleNames.length) {
      throw new ForbiddenException();
    }

    if (roleNames.includes(RoleName.SUPER_ADMIN)) {
      return true;
    }

    const moduleRecord = await this.prisma.appModule.findUnique({
      where: { key: requiredPermission.moduleKey },
      include: {
        permissions: {
          where: { role: { name: { in: roleNames as RoleName[] } } },
        },
      },
    });

    if (!moduleRecord?.isEnabled) {
      throw new ForbiddenException();
    }

    const allowed = moduleRecord.permissions.some((permission) => {
      if (requiredPermission.action === PermissionAction.VIEW) return permission.canView;
      if (requiredPermission.action === PermissionAction.CREATE) return permission.canCreate;
      if (requiredPermission.action === PermissionAction.UPDATE) return permission.canUpdate;
      if (requiredPermission.action === PermissionAction.DELETE) return permission.canDelete;
      return false;
    });

    if (!allowed) {
      throw new ForbiddenException();
    }

    return true;
  }
}
