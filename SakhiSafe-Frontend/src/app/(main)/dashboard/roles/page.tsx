"use client";

import Link from "next/link";

import { ShieldCheck } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { AccessDenied } from "@/components/dashboard/access-denied";
import { EmptyState, ErrorState, LoadingState } from "@/components/dashboard/page-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRolesQuery } from "@/lib/api/queries";
import { ModuleRouteGuard } from "@/lib/auth/module-route-guard";
import { can } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth/auth-store";

export default function RolesPage() {
  const user = useAuthStore((state) => state.user);
  const { data, isLoading, isError, error } = useRolesQuery();

  if (!can(user, "ROLES", "VIEW")) {
    return <AccessDenied />;
  }

  if (isLoading) {
    return <LoadingState label="Loading roles" />;
  }

  if (isError) {
    return <ErrorState message={error.message} />;
  }

  return (
    <ModuleRouteGuard moduleKey="ROLES">
      <PageHeader title="Roles" description="Review role records and manage module permissions." />
      {!data?.length ? (
        <EmptyState title="No roles found" />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-36 text-right">Permissions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((role) => (
                <TableRow key={role.id}>
                  <TableCell>
                    <Badge variant="outline">{role.name}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{role.description ?? "-"}</TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/dashboard/roles/${role.id}/permissions`} prefetch={false}>
                        <ShieldCheck className="size-4" />
                        Manage
                      </Link>
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
