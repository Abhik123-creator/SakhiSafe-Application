"use client";

import { Power } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { AccessDenied } from "@/components/dashboard/access-denied";
import { EmptyState, ErrorState, LoadingState } from "@/components/dashboard/page-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useModulesQuery, useToggleModuleMutation } from "@/lib/api/queries";
import { ModuleRouteGuard } from "@/lib/auth/module-route-guard";
import { can } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth/auth-store";

export default function ModulesPage() {
  const user = useAuthStore((state) => state.user);
  const { data, isLoading, isError, error } = useModulesQuery();
  const toggleModule = useToggleModuleMutation();

  if (!can(user, "MODULES", "VIEW")) {
    return <AccessDenied />;
  }

  if (isLoading) {
    return <LoadingState label="Loading modules" />;
  }

  if (isError) {
    return <ErrorState message={error.message} />;
  }

  return (
    <ModuleRouteGuard moduleKey="MODULES">
      <PageHeader title="Modules" description="Enable or disable application modules." />
      {!data?.length ? (
        <EmptyState title="No modules found" />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-28 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((moduleRecord) => (
                <TableRow key={moduleRecord.id}>
                  <TableCell className="font-medium">{moduleRecord.name}</TableCell>
                  <TableCell className="font-mono text-xs">{moduleRecord.key}</TableCell>
                  <TableCell className="text-muted-foreground">{moduleRecord.description ?? "-"}</TableCell>
                  <TableCell>
                    <Badge variant={moduleRecord.isEnabled ? "default" : "secondary"}>
                      {moduleRecord.isEnabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={toggleModule.isPending}
                      onClick={() => toggleModule.mutate(moduleRecord.id)}
                    >
                      <Power className="size-4" />
                      Toggle
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </ModuleRouteGuard>
  );
}
