import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuditAction, ModuleKey, RoleName } from '@prisma/client';
import { AuditService } from '../../audit/services/audit.service';
import { maskIpAddress } from '../../common/utils/mask-sensitive-data.util';
import { verifyPassword } from '../../common/utils/password.util';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../../users/services/users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.isActive || !(await verifyPassword(password, user.passwordHash))) {
      throw new UnauthorizedException();
    }
    return this.withPermissions(this.usersService.toSafeUser(user));
  }

  async login(user: any, request?: any) {
    const payload = { sub: user.id, email: user.email, roles: user.roles };
    await this.auditService.create({
      actorUserId: user.id,
      action: AuditAction.USER_LOGIN,
      entityType: 'User',
      entityId: user.id,
      ipAddress: maskIpAddress(request?.ip),
      userAgent: request?.headers?.['user-agent'],
      metadata: { email: user.email },
    });
    return {
      accessToken: await this.jwtService.signAsync(payload),
      user,
    };
  }

  async me(userId: string) {
    const user = await this.usersService.findById(userId);
    return this.withPermissions(this.usersService.toSafeUser(user));
  }

  private async withPermissions(user: any) {
    const roles = (user.roles ?? []) as RoleName[];
    const enabledModules = await this.prisma.appModule.findMany({
      where: { isEnabled: true },
      select: { key: true },
      orderBy: { key: 'asc' },
    });

    if (roles.includes(RoleName.SUPER_ADMIN)) {
      return {
        ...user,
        permissions: enabledModules.map((moduleRecord) => ({
          moduleKey: moduleRecord.key,
          canView: true,
          canCreate: true,
          canUpdate: true,
          canDelete: true,
        })),
        enabledModules: enabledModules.map((moduleRecord) => moduleRecord.key),
      };
    }

    const permissions = await this.prisma.rolePermission.findMany({
      where: { role: { name: { in: roles } }, module: { isEnabled: true } },
      include: { module: true },
    });

    const byModule = new Map<ModuleKey, { moduleKey: ModuleKey; canView: boolean; canCreate: boolean; canUpdate: boolean; canDelete: boolean }>();
    for (const permission of permissions) {
      const existing = byModule.get(permission.module.key) ?? {
        moduleKey: permission.module.key,
        canView: false,
        canCreate: false,
        canUpdate: false,
        canDelete: false,
      };
      byModule.set(permission.module.key, {
        moduleKey: permission.module.key,
        canView: existing.canView || permission.canView,
        canCreate: existing.canCreate || permission.canCreate,
        canUpdate: existing.canUpdate || permission.canUpdate,
        canDelete: existing.canDelete || permission.canDelete,
      });
    }

    return {
      ...user,
      permissions: Array.from(byModule.values()),
      enabledModules: enabledModules.map((moduleRecord) => moduleRecord.key),
    };
  }
}
