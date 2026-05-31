"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { AccessDenied } from "@/components/dashboard/access-denied";
import { CreateCareSeekerDialog } from "@/components/dashboard/create-care-seeker-dialog";
import { EmptyState, ErrorState, LoadingState } from "@/components/dashboard/page-state";
import { ResourceTable } from "@/components/dashboard/resource-table";
import { Badge } from "@/components/ui/badge";
import { useCareSeekersQuery } from "@/lib/api/queries";
import { ModuleRouteGuard } from "@/lib/auth/module-route-guard";
import { can } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth/auth-store";
import type { CareSeeker } from "@/lib/api/types";

export default function CareSeekersPage() {
  const user = useAuthStore((state) => state.user);
  const { data, isLoading, isError, error } = useCareSeekersQuery();

  if (!can(user, "CARE_SEEKERS", "VIEW")) {
    return <AccessDenied />;
  }

  if (isLoading) {
    return <LoadingState label="Loading care seekers" />;
  }

  if (isError) {
    return <ErrorState message={error.message} />;
  }

  return (
    <ModuleRouteGuard moduleKey="CARE_SEEKERS">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <PageHeader title="Care Seekers" description="Sensitive records are displayed only through authorized API responses." />
        {can(user, "CARE_SEEKERS", "CREATE") && <CreateCareSeekerDialog />}
      </div>
      {!data?.length ? (
        <EmptyState title="No care seekers found" />
      ) : (
        <ResourceTable<CareSeeker>
          rows={data}
          columns={[
            { key: "fullName", header: "Name", cell: (row) => row.fullName },
            { key: "riskLevel", header: "Risk", cell: (row) => <Badge>{row.riskLevel}</Badge> },
            { key: "phone", header: "Phone", cell: (row) => row.phone ?? "-" },
            { key: "address", header: "Address", cell: (row) => row.address ?? "-" },
          ]}
        />
      )}
    </ModuleRouteGuard>
  );
}
