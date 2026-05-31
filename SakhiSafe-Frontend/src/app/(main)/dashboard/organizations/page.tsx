"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { AccessDenied } from "@/components/dashboard/access-denied";
import { CreateOrganizationDialog } from "@/components/dashboard/create-organization-dialog";
import { EmptyState, ErrorState, LoadingState } from "@/components/dashboard/page-state";
import { ResourceTable } from "@/components/dashboard/resource-table";
import { Badge } from "@/components/ui/badge";
import { useOrganizationsQuery } from "@/lib/api/queries";
import { ModuleRouteGuard } from "@/lib/auth/module-route-guard";
import { can } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth/auth-store";
import type { Organization } from "@/lib/api/types";

export default function OrganizationsPage() {
  const user = useAuthStore((state) => state.user);
  const { data, isLoading, isError, error } = useOrganizationsQuery();

  if (!can(user, "ORGANIZATIONS", "VIEW")) {
    return <AccessDenied />;
  }

  if (isLoading) {
    return <LoadingState label="Loading organizations" />;
  }

  if (isError) {
    return <ErrorState message={error.message} />;
  }

  return (
    <ModuleRouteGuard moduleKey="ORGANIZATIONS">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <PageHeader title="Organizations" description="NGO, government, and response organizations." />
        {can(user, "ORGANIZATIONS", "CREATE") && <CreateOrganizationDialog />}
      </div>
      {!data?.length ? (
        <EmptyState title="No organizations found" />
      ) : (
        <ResourceTable<Organization>
          rows={data}
          columns={[
            { key: "name", header: "Name", cell: (row) => row.name },
            { key: "type", header: "Type", cell: (row) => <Badge variant="outline">{row.type}</Badge> },
            { key: "phone", header: "Phone", cell: (row) => row.phone ?? "-" },
            { key: "address", header: "Address", cell: (row) => row.address ?? "-" },
          ]}
        />
      )}
    </ModuleRouteGuard>
  );
}
