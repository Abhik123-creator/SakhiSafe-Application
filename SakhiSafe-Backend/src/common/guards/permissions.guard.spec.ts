import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ModuleKey, PermissionAction, RoleName } from '@prisma/client';
import { REQUIRE_PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { PermissionsGuard } from './permissions.guard';

describe('PermissionsGuard', () => {
  const reflector = { getAllAndOverride: jest.fn() } as unknown as Reflector;
  const prisma = { appModule: { findUnique: jest.fn() } };
  const guard = new PermissionsGuard(reflector, prisma as any);

  function context(user: any) {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as any;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows routes without permission metadata', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    await expect(guard.canActivate(context(null))).resolves.toBe(true);
  });

  it('allows SUPER_ADMIN before querying modules or permissions', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === REQUIRE_PERMISSION_KEY) {
        return { moduleKey: ModuleKey.CASES, action: PermissionAction.VIEW };
      }
      return false;
    });

    await expect(guard.canActivate(context({ roles: [{ name: RoleName.SUPER_ADMIN }] }))).resolves.toBe(true);
    expect(prisma.appModule.findUnique).not.toHaveBeenCalled();
  });

  it('denies when a non-super-admin role has no permission row', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === REQUIRE_PERMISSION_KEY) {
        return { moduleKey: ModuleKey.USERS, action: PermissionAction.VIEW };
      }
      return false;
    });
    prisma.appModule.findUnique.mockResolvedValue({ isEnabled: true, permissions: [] });

    await expect(guard.canActivate(context({ roles: [RoleName.ORGANIZATION] }))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows when a non-super-admin role has the required permission', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === REQUIRE_PERMISSION_KEY) {
        return { moduleKey: ModuleKey.CASES, action: PermissionAction.UPDATE };
      }
      return false;
    });
    prisma.appModule.findUnique.mockResolvedValue({ isEnabled: true, permissions: [{ canUpdate: true }] });

    await expect(guard.canActivate(context({ roles: [RoleName.ORGANIZATION] }))).resolves.toBe(true);
  });
});
