import type { AuthUser, ModuleKey, PermissionAction, RoleName } from "@/lib/api/types";

const actionToField: Record<PermissionAction, "canView" | "canCreate" | "canUpdate" | "canDelete"> = {
  VIEW: "canView",
  CREATE: "canCreate",
  UPDATE: "canUpdate",
  DELETE: "canDelete",
};

export function hasRole(user: AuthUser | null | undefined, role: RoleName) {
  return Boolean(user?.roles?.includes(role));
}

export function isSuperAdmin(user: AuthUser | null | undefined) {
  return hasRole(user, "SUPER_ADMIN");
}

export function isModuleEnabled(user: AuthUser | null | undefined, moduleKey: ModuleKey) {
  return isSuperAdmin(user) || Boolean(user?.enabledModules?.includes(moduleKey));
}

export function can(user: AuthUser | null | undefined, moduleKey: ModuleKey, action: PermissionAction) {
  if (isSuperAdmin(user)) {
    return true;
  }
  if (!isModuleEnabled(user, moduleKey)) {
    return false;
  }
  const permission = user?.permissions?.find((item) => item.moduleKey === moduleKey);
  return Boolean(permission?.[actionToField[action]]);
}
