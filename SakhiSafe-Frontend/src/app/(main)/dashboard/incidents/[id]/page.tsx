"use client";

import { useEffect, useState } from "react";
import { ExternalLink, ImageIcon, Save } from "lucide-react";
import { useParams } from "next/navigation";

import { AccessDenied } from "@/components/dashboard/access-denied";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/dashboard/page-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/api/client";
import { useIncidentEvidenceQuery, useIncidentQuery, useUpdateIncidentMutation } from "@/lib/api/queries";
import type { EvidenceListItem, IncidentCategory, IncidentSeverity, IncidentStatus, IncidentUrgency, UpdateIncidentInput } from "@/lib/api/types";
import { ModuleRouteGuard } from "@/lib/auth/module-route-guard";
import { can } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth/auth-store";

const categoryOptions: IncidentCategory[] = [
  "DOMESTIC_VIOLENCE",
  "PHYSICAL_ABUSE",
  "EMOTIONAL_ABUSE",
  "SEXUAL_ABUSE",
  "FINANCIAL_ABUSE",
  "STALKING",
  "HARASSMENT",
  "THREAT",
  "OTHER",
  "UNKNOWN",
];
const severityOptions: IncidentSeverity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL", "UNKNOWN"];
const urgencyOptions: IncidentUrgency[] = ["LOW", "SOON", "URGENT", "IMMEDIATE", "UNKNOWN"];
const statusOptions: IncidentStatus[] = ["DRAFT", "OPEN", "UNDER_REVIEW", "CLOSED"];

function TagList({ items, emptyLabel }: { items?: string[] | null; emptyLabel: string }) {
  if (!items?.length) {
    return <div className="text-muted-foreground text-sm">{emptyLabel}</div>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Badge key={item} variant="outline">
          {item}
        </Badge>
      ))}
    </div>
  );
}

function FieldValue({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="font-medium text-sm">{value || "-"}</div>
    </div>
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FormattedMediaObservation({ text }: { text?: string | null }) {
  const sections = (text || "")
    .split(/\n+/)
    .map((section) => section.trim())
    .filter(Boolean);

  if (!sections.length) {
    return <div className="text-sm font-medium">No image summary provided.</div>;
  }

  const [rawOverview, ...details] = sections;
  const overviewSeparatorIndex = rawOverview.indexOf(":");
  const overview =
    overviewSeparatorIndex !== -1 && overviewSeparatorIndex <= 42
      ? rawOverview.slice(overviewSeparatorIndex + 1).trim()
      : rawOverview;
  const parsedDetails = details.map((detail) => {
    const separatorIndex = detail.indexOf(":");
    if (separatorIndex === -1 || separatorIndex > 42) {
      return { label: null, value: detail };
    }
    return {
      label: detail.slice(0, separatorIndex).trim(),
      value: detail.slice(separatorIndex + 1).trim(),
    };
  });

  return (
    <div className="space-y-3">
      <div className="rounded-md border bg-muted/35 p-3">
        <div className="mb-1 text-muted-foreground text-xs font-medium uppercase tracking-normal">Observation</div>
        <p className="text-sm leading-6">{overview}</p>
      </div>
      {parsedDetails.length ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {parsedDetails.map((detail, index) => (
            <div key={`${detail.label || "detail"}-${index}`} className="rounded-md border p-3">
              {detail.label ? (
                <div className="mb-1 text-muted-foreground text-xs font-medium uppercase tracking-normal">
                  {detail.label}
                </div>
              ) : null}
              <p className="text-sm leading-6">{detail.value}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function EvidenceImage({ evidence }: { evidence: EvidenceListItem }) {
  const [objectUrl, setObjectUrl] = useState<string>();
  const [error, setError] = useState<string>();
  const imageSummary = evidence.aiSummary || evidence.caption;

  useEffect(() => {
    let url: string | undefined;
    let cancelled = false;

    apiClient
      .get(`/admin/v1/evidence/${evidence.id}/file`, { responseType: "blob" })
      .then((response) => {
        if (cancelled) {
          return;
        }
        url = URL.createObjectURL(response.data);
        setObjectUrl(url);
      })
      .catch((requestError: Error) => {
        if (!cancelled) {
          setError(requestError.message);
        }
      });

    return () => {
      cancelled = true;
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [evidence.id]);

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="flex aspect-video items-center justify-center bg-muted">
        {objectUrl ? (
          <img src={objectUrl} alt={imageSummary || "Victim provided evidence"} className="h-full w-full object-contain" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground text-sm">
            <ImageIcon className="size-8" />
            {error ? "Unable to load image" : "Loading image"}
          </div>
        )}
      </div>
      <div className="space-y-2 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge variant="outline">{evidence.uploadedBy}</Badge>
          <span className="text-muted-foreground text-xs">{new Date(evidence.createdAt).toLocaleString()}</span>
        </div>
        <div className="space-y-3">
          <FormattedMediaObservation text={imageSummary} />
          {evidence.description && evidence.description !== imageSummary ? (
            <div className="rounded-md border border-dashed p-3">
              <div className="mb-1 text-muted-foreground text-xs font-medium uppercase tracking-normal">Additional note</div>
              <p className="text-muted-foreground text-sm leading-6">{evidence.description}</p>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2 text-muted-foreground text-xs">
          <span>{evidence.mimeType}</span>
          <span>{formatFileSize(evidence.fileSize)}</span>
          {typeof evidence.aiConfidence === "number" ? <span>AI confidence {(evidence.aiConfidence * 100).toFixed(0)}%</span> : null}
          {evidence.aiAnalysisStatus ? <span>{evidence.aiAnalysisStatus}</span> : null}
        </div>
        <Button asChild size="sm" variant="outline">
          <a href={objectUrl} target="_blank" rel="noreferrer">
            <ExternalLink />
            Open
          </a>
        </Button>
      </div>
    </div>
  );
}

export default function IncidentDetailPage() {
  const params = useParams<{ id: string }>();
  const user = useAuthStore((state) => state.user);
  const canEdit = can(user, "INCIDENTS", "UPDATE");
  const { data, isLoading, isError, error } = useIncidentQuery(params.id);
  const evidenceQuery = useIncidentEvidenceQuery(params.id);
  const updateIncident = useUpdateIncidentMutation(params.id);
  const [form, setForm] = useState<UpdateIncidentInput>({});

  useEffect(() => {
    if (data) {
      setForm({
        title: data.title,
        summary: data.summary ?? "",
        description: data.description ?? "",
        category: data.category,
        severity: data.severity,
        urgency: data.urgency,
        status: data.status,
        caseNote: data.caseNote ?? "",
        needsHumanReview: data.needsHumanReview,
      });
    }
  }, [data]);

  if (!can(user, "INCIDENTS", "VIEW")) {
    return <AccessDenied />;
  }

  if (isLoading) {
    return <LoadingState label="Loading incident" />;
  }

  if (isError) {
    return <ErrorState message={error.message} />;
  }

  if (!data) {
    return <EmptyState title="Incident not found" />;
  }

  const messages = data.conversationMessagesTimeline ?? [];
  const evidence = evidenceQuery.data ?? data.evidence ?? [];

  return (
    <ModuleRouteGuard moduleKey="INCIDENTS">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <PageHeader title={data.title} description="AI-organized incident record linked to the intake conversation." />
        {canEdit && (
          <Button
            disabled={updateIncident.isPending}
            onClick={() => updateIncident.mutate(form)}
          >
            <Save />
            Save
          </Button>
        )}
      </div>

      {updateIncident.isError && <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-destructive text-sm">{updateIncident.error.message}</div>}
      {updateIncident.isSuccess && <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-700 text-sm">Incident updated.</div>}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Case View</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    disabled={!canEdit}
                    value={form.title ?? ""}
                    onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select disabled={!canEdit} value={form.category} onValueChange={(value) => setForm((current) => ({ ...current, category: value as IncidentCategory }))}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categoryOptions.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Severity</Label>
                  <Select disabled={!canEdit} value={form.severity} onValueChange={(value) => setForm((current) => ({ ...current, severity: value as IncidentSeverity }))}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {severityOptions.map((severity) => (
                        <SelectItem key={severity} value={severity}>
                          {severity}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Urgency</Label>
                  <Select disabled={!canEdit} value={form.urgency} onValueChange={(value) => setForm((current) => ({ ...current, urgency: value as IncidentUrgency }))}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {urgencyOptions.map((urgency) => (
                        <SelectItem key={urgency} value={urgency}>
                          {urgency}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select disabled={!canEdit} value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value as IncidentStatus }))}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="summary">Summary</Label>
                <Textarea
                  id="summary"
                  disabled={!canEdit}
                  value={form.summary ?? ""}
                  onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  disabled={!canEdit}
                  value={form.description ?? ""}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="caseNote">Case notes</Label>
                <Textarea
                  id="caseNote"
                  disabled={!canEdit}
                  value={form.caseNote ?? ""}
                  onChange={(event) => setForm((current) => ({ ...current, caseNote: event.target.value }))}
                />
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={form.needsHumanReview ?? false}
                  disabled={!canEdit}
                  onCheckedChange={(checked) => setForm((current) => ({ ...current, needsHumanReview: checked }))}
                />
                <Label>Needs human review</Label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Conversation Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!messages.length ? (
                <div className="text-muted-foreground text-sm">No messages recorded for this incident.</div>
              ) : (
                messages.map((message) => (
                  <div key={message.id} className="rounded-lg border p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={message.direction === "INBOUND" ? "outline" : "secondary"}>{message.direction}</Badge>
                        <Badge variant="outline">{message.messageType}</Badge>
                      </div>
                      <span className="text-muted-foreground text-xs">{new Date(message.createdAt).toLocaleString()}</span>
                    </div>
                    {message.messageType === "IMAGE" ? (
                      <div className="flex items-center gap-2 text-sm">
                        <ImageIcon className="size-4 text-muted-foreground" />
                        <span>{message.messageText || "Image evidence received"}</span>
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap text-sm">{message.messageText}</div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Media observations</CardTitle>
            </CardHeader>
            <CardContent>
              {evidenceQuery.isError ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-destructive text-sm">
                  {evidenceQuery.error.message}
                </div>
              ) : !evidence.length ? (
                <div className="text-muted-foreground text-sm">No media observations are linked to this case record yet.</div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {evidence.map((item) => (
                    <EvidenceImage key={item.id} evidence={item} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Linked Records</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <FieldValue label="Care seeker" value={data.careSeeker?.displayName} />
              <FieldValue label="Phone" value={data.careSeeker?.whatsappPhoneNumber ?? data.careSeeker?.phoneNumber} />
              <FieldValue label="Source" value={data.source} />
              <FieldValue label="Channel" value={data.conversationSession?.channel} />
              <FieldValue label="Session status" value={data.conversationSession?.status} />
              <FieldValue label="AI confidence" value={data.aiConfidence == null ? null : String(data.aiConfidence)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Context</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <FieldValue label="Incident date" value={data.incidentDateText} />
              <FieldValue label="Location" value={data.locationText} />
              <FieldValue label="Perpetrator relation" value={data.perpetratorRelation} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Risk Signals</CardTitle>
            </CardHeader>
            <CardContent>
              <TagList items={data.riskSignals} emptyLabel="No risk signals recorded." />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Missing Fields</CardTitle>
            </CardHeader>
            <CardContent>
              <TagList items={data.missingFields} emptyLabel="No missing fields recorded." />
            </CardContent>
          </Card>
        </div>
      </div>
    </ModuleRouteGuard>
  );
}
