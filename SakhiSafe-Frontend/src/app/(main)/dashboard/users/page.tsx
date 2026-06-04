"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { AccessDenied } from "@/components/dashboard/access-denied";
import { CreateUserDialog } from "@/components/dashboard/create-user-dialog";
import { EmptyState, ErrorState, LoadingState } from "@/components/dashboard/page-state";
import { ResourceTable } from "@/components/dashboard/resource-table";
import { Badge } from "@/components/ui/badge";
import { useUsersQuery } from "@/lib/api/queries";
import { ModuleRouteGuard } from "@/lib/auth/module-route-guard";
import { can } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth/auth-store";
import type { User } from "@/lib/api/types";

export default function UsersPage() {
  const user = useAuthStore((state) => state.user);
  const { data, isLoading, isError, error } = useUsersQuery();
  const canCreate = can(user, "USERS", "CREATE");

  if (!can(user, "USERS", "VIEW")) {
    return <AccessDenied />;
  }

  if (isLoading) {
    return <LoadingState label="Loading users" />;
  }

  if (isError) {
    return <ErrorState message={error.message} />;
  }

  return (
    <ModuleRouteGuard moduleKey="USERS">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <PageHeader title="Users" description="Application users and assigned roles from the backend." />
        {canCreate && <CreateUserDialog />}
      </div>
      {!data?.length ? (
        <EmptyState title="No users found" />
      ) : (
        <ResourceTable<User>
          rows={data}
          columns={[
            { key: "name", header: "Name", cell: (row) => row.name },
            { key: "email", header: "Email", cell: (row) => row.email },
            {
              key: "roles",
              header: "Roles",
              cell: (row) => (
                <div className="flex flex-wrap gap-1">
                  {(row.roles ?? []).map((userRole) => (
                    <Badge key={userRole.role.id} variant="outline">
                      {userRole.role.name}
                    </Badge>
                  ))}
                </div>
              ),
            },
            { key: "isActive", header: "Status", cell: (row) => (row.isActive === false ? "Inactive" : "Active") },
          ]}
        />
      )}
    </ModuleRouteGuard>
  );
}
