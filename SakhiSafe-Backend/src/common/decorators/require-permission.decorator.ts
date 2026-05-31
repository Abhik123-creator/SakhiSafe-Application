import { SetMetadata } from '@nestjs/common';
import { ModuleKey, PermissionAction } from '@prisma/client';

export const REQUIRE_PERMISSION_KEY = 'requiredPermission';

export interface RequiredPermission {
  moduleKey: ModuleKey;
  action: PermissionAction;
}

export const RequirePermission = (moduleKey: ModuleKey, action: PermissionAction) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, { moduleKey, action } satisfies RequiredPermission);
