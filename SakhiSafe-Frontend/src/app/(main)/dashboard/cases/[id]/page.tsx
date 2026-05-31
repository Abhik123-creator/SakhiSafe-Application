"use client";

import { useParams } from "next/navigation";

import { PageHeader } from "@/components/dashboard/page-header";
import { AccessDenied } from "@/components/dashboard/access-denied";
import { EmptyState, ErrorState, LoadingState } from "@/components/dashboard/page-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCaseQuery } from "@/lib/api/queries";
import { ModuleRouteGuard } from "@/lib/auth/module-route-guard";
import { can } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth/auth-store";

export default function CaseDetailPage() {
  const params = useParams<{ id: string }>();
  const user = useAuthStore((state) => state.user);
  const { data, isLoading, isError, error } = useCaseQuery(params.id);

  if (!can(user, "CASES", "VIEW")) {
    return <AccessDenied />;
  }

  if (isLoading) {
    return <LoadingState label="Loading case" />;
  }

  if (isError) {
    return <ErrorState message={error.message} />;
  }

  if (!data) {
    return <EmptyState title="Case not found" />;
  }

  return (
    <ModuleRouteGuard moduleKey="CASES">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <PageHeader title={data.title} description="Case detail from the backend API." />
        <div className="flex gap-2">
          {can(user, "CASES", "UPDATE") && <Button variant="outline">Edit</Button>}
          {can(user, "CASES", "DELETE") && <Button variant="destructive">Delete</Button>}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Badge variant="outline">{data.status}</Badge>
            <Badge>{data.riskLevel}</Badge>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">{data.summary ?? "No summary recorded."}</CardContent>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Linked Records</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm md:grid-cols-3">
            <div>
              <div className="text-muted-foreground">Care seeker</div>
              <div className="font-medium">{data.careSeeker?.fullName ?? "Restricted"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Organization</div>
              <div className="font-medium">{data.organization?.name ?? "-"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Assigned to</div>
              <div className="font-medium">{data.assignedTo?.name ?? "Unassigned"}</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </ModuleRouteGuard>
  );
}
