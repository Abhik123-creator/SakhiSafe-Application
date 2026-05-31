export function extractRoleNames(user: any): string[] {
  if (!user?.roles || !Array.isArray(user.roles)) {
    return [];
  }

  return user.roles
    .map((role: any) => {
      if (typeof role === 'string') {
        return role;
      }
      if (typeof role?.name === 'string') {
        return role.name;
      }
      if (typeof role?.role?.name === 'string') {
        return role.role.name;
      }
      return null;
    })
    .filter((roleName: string | null): roleName is string => Boolean(roleName));
}
