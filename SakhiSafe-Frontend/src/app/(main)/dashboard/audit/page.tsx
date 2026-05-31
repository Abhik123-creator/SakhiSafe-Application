"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { AccessDenied } from "@/components/dashboard/access-denied";
import { EmptyState, ErrorState, LoadingState } from "@/components/dashboard/page-state";
import { ResourceTable } from "@/components/dashboard/resource-table";
import { Badge } from "@/components/ui/badge";
import { useAuditLogsQuery } from "@/lib/api/queries";
import { ModuleRouteGuard } from "@/lib/auth/module-route-guard";
import { can } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth/auth-store";
import type { AuditLog } from "@/lib/api/types";

export default function AuditLogsPage() {
  const user = useAuthStore((state) => state.user);
  const { data, isLoading, isError, error } = useAuditLogsQuery();

  if (!can(user, "AUDIT_LOGS", "VIEW")) {
    return <AccessDenied />;
  }

  if (isLoading) {
    return <LoadingState label="Loading audit logs" />;
  }

  if (isError) {
    return <ErrorState message={error.message} />;
  }

  return (
    <ModuleRouteGuard moduleKey="AUDIT_LOGS">
      <PageHeader title="Audit Logs" description="Security-sensitive actions recorded by the backend." />
      {!data?.length ? (
        <EmptyState title="No audit logs found" />
      ) : (
        <ResourceTable<AuditLog>
          rows={data}
          columns={[
            { key: "action", header: "Action", cell: (row) => <Badge variant="outline">{row.action}</Badge> },
            { key: "entityType", header: "Entity", cell: (row) => row.entityType },
            { key: "actorUserId", header: "Actor", cell: (row) => row.actorUserId ?? "System" },
            { key: "createdAt", header: "Created", cell: (row) => new Date(row.createdAt).toLocaleString() },
          ]}
        />
      )}
    </ModuleRouteGuard>
  );
}
