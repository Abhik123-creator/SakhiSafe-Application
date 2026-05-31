import { RoleName } from '@prisma/client';

export const ADMIN_ROLES: RoleName[] = [RoleName.SUPER_ADMIN, RoleName.SYSTEM_ADMIN, RoleName.NGO_ADMIN];

export const ALL_ROLES: RoleName[] = [
  RoleName.SUPER_ADMIN,
  RoleName.SYSTEM_ADMIN,
  RoleName.NGO_ADMIN,
  RoleName.NGO_WORKER,
  RoleName.ERT_ADMIN,
  RoleName.ERT_RESPONDER,
  RoleName.GOV_ADMIN,
  RoleName.CASE_MANAGER,
  RoleName.COUNSELLOR,
  RoleName.LEGAL_ADVISOR,
  RoleName.AI_SERVICE,
  RoleName.MESSAGING_SERVICE,
];
