"use client";

import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/dashboard/page-header";
import { AccessDenied } from "@/components/dashboard/access-denied";
import { CreateCaseDialog } from "@/components/dashboard/create-case-dialog";
import { EmptyState, ErrorState, LoadingState } from "@/components/dashboard/page-state";
import { ResourceTable } from "@/components/dashboard/resource-table";
import { useCasesQuery } from "@/lib/api/queries";
import { ModuleRouteGuard } from "@/lib/auth/module-route-guard";
import { can } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth/auth-store";
import type { CaseRecord } from "@/lib/api/types";

export default function CasesPage() {
  const user = useAuthStore((state) => state.user);
  const { data, isLoading, isError, error } = useCasesQuery();

  if (!can(user, "CASES", "VIEW")) {
    return <AccessDenied />;
  }

  if (isLoading) {
    return <LoadingState label="Loading cases" />;
  }

  if (isError) {
    return <ErrorState message={error.message} />;
  }

  return (
    <ModuleRouteGuard moduleKey="CASES">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <PageHeader title="Cases" description="Track active case work and review risk status." />
        {can(user, "CASES", "CREATE") && <CreateCaseDialog />}
      </div>
      {!data?.length ? (
        <EmptyState title="No cases found" />
      ) : (
        <ResourceTable<CaseRecord>
          rows={data}
          detailBasePath="/dashboard/cases"
          columns={[
            { key: "title", header: "Title", cell: (row) => row.title },
            { key: "status", header: "Status", cell: (row) => <Badge variant="outline">{row.status}</Badge> },
            { key: "riskLevel", header: "Risk", cell: (row) => <Badge>{row.riskLevel}</Badge> },
            { key: "careSeeker", header: "Care Seeker", cell: (row) => row.careSeeker?.fullName ?? "Restricted" },
            { key: "createdAt", header: "Created", cell: (row) => row.createdAt ? new Date(row.createdAt).toLocaleString() : "-" },
          ]}
        />
      )}
    </ModuleRouteGuard>
  );
}
