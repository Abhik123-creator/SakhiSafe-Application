import { Reflector } from '@nestjs/core';
import { RoleName } from '@prisma/client';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  const reflector = { getAllAndOverride: jest.fn() } as unknown as Reflector;
  const guard = new RolesGuard(reflector);

  function context(roles: string[]) {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({ getRequest: () => ({ user: { roles } }) }),
    } as any;
  }

  it('allows routes without role metadata', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(context([]))).toBe(true);
  });

  it('allows matching role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([RoleName.SUPER_ADMIN]);
    expect(guard.canActivate(context([RoleName.SUPER_ADMIN]))).toBe(true);
  });

  it('denies missing role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([RoleName.SUPER_ADMIN]);
    expect(guard.canActivate(context([RoleName.NGO_WORKER]))).toBe(false);
  });
});
