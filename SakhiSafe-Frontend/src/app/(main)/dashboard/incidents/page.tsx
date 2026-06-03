"use client";

import { useState } from "react";

import { AccessDenied } from "@/components/dashboard/access-denied";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/dashboard/page-state";
import { ResourceTable } from "@/components/dashboard/resource-table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIncidentsQuery } from "@/lib/api/queries";
import type { IncidentFilters, IncidentListItem, IncidentSeverity, IncidentSource, IncidentStatus, IncidentUrgency } from "@/lib/api/types";
import { ModuleRouteGuard } from "@/lib/auth/module-route-guard";
import { can } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth/auth-store";

const statusOptions: IncidentStatus[] = ["DRAFT", "OPEN", "UNDER_REVIEW", "CLOSED"];
const severityOptions: IncidentSeverity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL", "UNKNOWN"];
const urgencyOptions: IncidentUrgency[] = ["LOW", "SOON", "URGENT", "IMMEDIATE", "UNKNOWN"];
const sourceOptions: IncidentSource[] = ["WHATSAPP", "WEB", "ADMIN"];

function reviewLabel(value?: boolean) {
  if (value === true) {
    return "Needs review";
  }
  if (value === false) {
    return "No review flag";
  }
  return "All review states";
}

function filterValue<T extends string>(value: string): T | undefined {
  return value === "ALL" ? undefined : (value as T);
}

function IncidentFiltersBar({
  filters,
  onChange,
}: {
  filters: IncidentFilters;
  onChange: (filters: IncidentFilters) => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      <Select value={filters.status ?? "ALL"} onValueChange={(value) => onChange({ ...filters, status: filterValue<IncidentStatus>(value) })}>
        <SelectTrigger className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All statuses</SelectItem>
          {statusOptions.map((status) => (
            <SelectItem key={status} value={status}>
              {status}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={filters.severity ?? "ALL"} onValueChange={(value) => onChange({ ...filters, severity: filterValue<IncidentSeverity>(value) })}>
        <SelectTrigger className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All severities</SelectItem>
          {severityOptions.map((severity) => (
            <SelectItem key={severity} value={severity}>
              {severity}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={filters.urgency ?? "ALL"} onValueChange={(value) => onChange({ ...filters, urgency: filterValue<IncidentUrgency>(value) })}>
        <SelectTrigger className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All urgencies</SelectItem>
          {urgencyOptions.map((urgency) => (
            <SelectItem key={urgency} value={urgency}>
              {urgency}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={filters.needsHumanReview === undefined ? "ALL" : String(filters.needsHumanReview)}
        onValueChange={(value) =>
          onChange({
            ...filters,
            needsHumanReview: value === "ALL" ? undefined : value === "true",
          })
        }
      >
        <SelectTrigger className="w-44">
          <SelectValue>{reviewLabel(filters.needsHumanReview)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All review states</SelectItem>
          <SelectItem value="true">Needs review</SelectItem>
          <SelectItem value="false">No review flag</SelectItem>
        </SelectContent>
      </Select>
      <Select value={filters.source ?? "ALL"} onValueChange={(value) => onChange({ ...filters, source: filterValue<IncidentSource>(value) })}>
        <SelectTrigger className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All sources</SelectItem>
          {sourceOptions.map((source) => (
            <SelectItem key={source} value={source}>
              {source}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default function IncidentsPage() {
  const user = useAuthStore((state) => state.user);
  const [filters, setFilters] = useState<IncidentFilters>({});
  const { data, isLoading, isError, error } = useIncidentsQuery(filters);

  if (!can(user, "INCIDENTS", "VIEW")) {
    return <AccessDenied />;
  }

  if (isLoading) {
    return <LoadingState label="Loading incidents" />;
  }

  if (isError) {
    return <ErrorState message={error.message} />;
  }

  return (
    <ModuleRouteGuard moduleKey="INCIDENTS">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <PageHeader title="Incidents" description="Review AI-organized intake records and linked conversation context." />
      </div>
      <IncidentFiltersBar filters={filters} onChange={setFilters} />
      {!data?.length ? (
        <EmptyState title="No incidents found" />
      ) : (
        <ResourceTable<IncidentListItem>
          rows={data}
          detailBasePath="/dashboard/incidents"
          columns={[
            { key: "title", header: "Title", cell: (row) => row.title },
            { key: "careSeekerPhoneNumber", header: "Phone", cell: (row) => row.careSeekerPhoneNumber ?? "-" },
            { key: "category", header: "Category", cell: (row) => <Badge variant="outline">{row.category}</Badge> },
            { key: "severity", header: "Severity", cell: (row) => <Badge>{row.severity}</Badge> },
            { key: "urgency", header: "Urgency", cell: (row) => <Badge variant="outline">{row.urgency}</Badge> },
            { key: "status", header: "Status", cell: (row) => <Badge variant="outline">{row.status}</Badge> },
            { key: "needsHumanReview", header: "Review", cell: (row) => (row.needsHumanReview ? <Badge>Required</Badge> : "-") },
            {
              key: "updatedAt",
              header: "Updated",
              cell: (row) => (row.updatedAt ? new Date(row.updatedAt).toLocaleString() : "-"),
            },
          ]}
        />
      )}
    </ModuleRouteGuard>
  );
}
