"use client";

import { useEffect, useMemo, useState } from "react";

import { useParams } from "next/navigation";

import { Save } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { AccessDenied } from "@/components/dashboard/access-denied";
import { EmptyState, ErrorState, LoadingState } from "@/components/dashboard/page-state";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useModulesQuery, useRolePermissionsQuery, useUpdateRolePermissionsMutation } from "@/lib/api/queries";
import type { ModuleKey } from "@/lib/api/types";
import { ModuleRouteGuard } from "@/lib/auth/module-route-guard";
import { can } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth/auth-store";

type EditablePermission = {
  moduleKey: ModuleKey;
  canView: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
};

const permissionLabels: Array<{ key: keyof Omit<EditablePermission, "moduleKey">; label: string }> = [
  { key: "canView", label: "VIEW" },
  { key: "canCreate", label: "CREATE" },
  { key: "canUpdate", label: "UPDATE" },
  { key: "canDelete", label: "DELETE" },
];

export default function RolePermissionsPage() {
  const params = useParams<{ id: string }>();
  const user = useAuthStore((state) => state.user);
  const roleId = params.id;
  const modulesQuery = useModulesQuery();
  const permissionsQuery = useRolePermissionsQuery(roleId);
  const updatePermissions = useUpdateRolePermissionsMutation(roleId);
  const [permissions, setPermissions] = useState<EditablePermission[]>([]);

  const mergedPermissions = useMemo(() => {
    const existing = new Map(
      (permissionsQuery.data ?? []).map((permission) => [permission.module?.key ?? permission.moduleKey, permission]),
    );

    return (modulesQuery.data ?? []).map((moduleRecord) => {
      const permission = existing.get(moduleRecord.key);
      return {
        moduleKey: moduleRecord.key,
        canView: permission?.canView ?? false,
        canCreate: permission?.canCreate ?? false,
        canUpdate: permission?.canUpdate ?? false,
        canDelete: permission?.canDelete ?? false,
      };
    });
  }, [modulesQuery.data, permissionsQuery.data]);

  useEffect(() => {
    setPermissions(mergedPermissions);
  }, [mergedPermissions]);

  const setPermission = (moduleKey: ModuleKey, key: keyof Omit<EditablePermission, "moduleKey">, checked: boolean) => {
    setPermissions((items) => items.map((item) => (item.moduleKey === moduleKey ? { ...item, [key]: checked } : item)));
  };

  if (!can(user, "ROLES", "VIEW")) {
    return <AccessDenied />;
  }

  if (modulesQuery.isLoading || permissionsQuery.isLoading) {
    return <LoadingState label="Loading role permissions" />;
  }

  if (modulesQuery.isError) {
    return <ErrorState message={modulesQuery.error.message} />;
  }

  if (permissionsQuery.isError) {
    return <ErrorState message={permissionsQuery.error.message} />;
  }

  return (
    <ModuleRouteGuard moduleKey="ROLES">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <PageHeader title="Role Permissions" description="Control module-level CRUD access for this role." />
        <Button disabled={updatePermissions.isPending} onClick={() => updatePermissions.mutate(permissions)}>
          <Save className="size-4" />
          Save Permissions
        </Button>
      </div>
      {!permissions.length ? (
        <EmptyState title="No modules found" />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Module</TableHead>
                {permissionLabels.map((permission) => (
                  <TableHead key={permission.key} className="text-center">
                    {permission.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {permissions.map((permission) => {
                const moduleRecord = modulesQuery.data?.find((item) => item.key === permission.moduleKey);
                return (
                  <TableRow key={permission.moduleKey}>
                    <TableCell>
                      <div className="font-medium">{moduleRecord?.name ?? permission.moduleKey}</div>
                      <div className="font-mono text-muted-foreground text-xs">{permission.moduleKey}</div>
                    </TableCell>
                    {permissionLabels.map((field) => (
                      <TableCell key={field.key} className="text-center">
                        <Checkbox
                          checked={permission[field.key]}
                          onCheckedChange={(checked) => setPermission(permission.moduleKey, field.key, checked === true)}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </ModuleRouteGuard>
  );
}
