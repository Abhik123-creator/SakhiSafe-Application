import { RoleName } from '@prisma/client';

export const ADMIN_ROLES: RoleName[] = [RoleName.SUPER_ADMIN, RoleName.ADMIN];

export const ALL_ROLES: RoleName[] = [
  RoleName.SUPER_ADMIN,
  RoleName.ADMIN,
  RoleName.ORGANIZATION,
  RoleName.CARE_SEEKER,
];
