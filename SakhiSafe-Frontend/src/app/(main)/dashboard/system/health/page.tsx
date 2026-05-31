"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { AccessDenied } from "@/components/dashboard/access-denied";
import { ErrorState, LoadingState } from "@/components/dashboard/page-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useHealthQuery } from "@/lib/api/queries";
import { ModuleRouteGuard } from "@/lib/auth/module-route-guard";
import { can } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth/auth-store";

export default function SystemHealthPage() {
  const user = useAuthStore((state) => state.user);
  const { data, isLoading, isError, error } = useHealthQuery();

  if (!can(user, "SYSTEM_SETTINGS", "VIEW")) {
    return <AccessDenied />;
  }

  if (isLoading) {
    return <LoadingState label="Checking system health" />;
  }

  if (isError) {
    return <ErrorState message={error.message} />;
  }

  return (
    <ModuleRouteGuard moduleKey="SYSTEM_SETTINGS">
      <PageHeader title="System Health" description="Live backend and database status." />
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>API</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge>{data?.status ?? "unknown"}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Database</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={data?.database === "ok" ? "default" : "destructive"}>{data?.database ?? "unknown"}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Timestamp</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{data?.timestamp ? new Date(data.timestamp).toLocaleString() : "-"}</CardContent>
        </Card>
      </div>
    </ModuleRouteGuard>
  );
}
