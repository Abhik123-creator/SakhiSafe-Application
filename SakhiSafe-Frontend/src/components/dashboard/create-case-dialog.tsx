"use client";

import { useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { ErrorState } from "@/components/dashboard/page-state";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useCareSeekersQuery, useCreateCaseMutation, useOrganizationsQuery, useUsersQuery } from "@/lib/api/queries";
import type { CaseStatus, RiskLevel } from "@/lib/api/types";

const riskLevels: RiskLevel[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const caseStatuses: CaseStatus[] = ["OPEN", "IN_PROGRESS", "ESCALATED", "RESOLVED", "CLOSED"];

const createCaseSchema = z.object({
  careSeekerId: z.string().min(1, "Care seeker is required"),
  title: z.string().min(2, "Title is required"),
  organizationId: z.string().optional(),
  assignedToId: z.string().optional(),
  summary: z.string().optional(),
  notes: z.string().optional(),
  incidentDescription: z.string().optional(),
  status: z.enum(caseStatuses),
  riskLevel: z.enum(riskLevels),
});

type CreateCaseValues = z.infer<typeof createCaseSchema>;

function cleanOptional(value?: string) {
  return value?.trim() ? value.trim() : undefined;
}

export function CreateCaseDialog() {
  const [open, setOpen] = useState(false);
  const careSeekers = useCareSeekersQuery();
  const organizations = useOrganizationsQuery();
  const users = useUsersQuery();
  const createCase = useCreateCaseMutation();
  const form = useForm<CreateCaseValues>({
    resolver: zodResolver(createCaseSchema),
    defaultValues: {
      careSeekerId: "",
      title: "",
      organizationId: "",
      assignedToId: "",
      summary: "",
      notes: "",
      incidentDescription: "",
      status: "OPEN",
      riskLevel: "MEDIUM",
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    createCase.mutate(
      {
        careSeekerId: values.careSeekerId,
        title: values.title.trim(),
        organizationId: cleanOptional(values.organizationId),
        assignedToId: cleanOptional(values.assignedToId),
        summary: cleanOptional(values.summary),
        notes: cleanOptional(values.notes),
        incidentDescription: cleanOptional(values.incidentDescription),
        status: values.status,
        riskLevel: values.riskLevel,
      },
      {
        onSuccess: () => {
          form.reset();
          setOpen(false);
        },
      },
    );
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          Create Case
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Case</DialogTitle>
          <DialogDescription>Open a case linked to a care seeker.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={onSubmit}>
          {createCase.isError && <ErrorState message={createCase.error.message} />}
          <div className="grid gap-2">
            <Label htmlFor="case-title">Title</Label>
            <Input id="case-title" {...form.register("title")} />
            {form.formState.errors.title && <p className="text-destructive text-xs">{form.formState.errors.title.message}</p>}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="case-care-seeker">Care Seeker</Label>
              <NativeSelect id="case-care-seeker" className="w-full" {...form.register("careSeekerId")}>
                <NativeSelectOption value="">Select care seeker</NativeSelectOption>
                {(careSeekers.data ?? []).map((careSeeker) => (
                  <NativeSelectOption key={careSeeker.id} value={careSeeker.id}>
                    {careSeeker.fullName}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              {form.formState.errors.careSeekerId && (
                <p className="text-destructive text-xs">{form.formState.errors.careSeekerId.message}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="case-organization">Organization</Label>
              <NativeSelect id="case-organization" className="w-full" {...form.register("organizationId")}>
                <NativeSelectOption value="">None</NativeSelectOption>
                {(organizations.data ?? []).map((organization) => (
                  <NativeSelectOption key={organization.id} value={organization.id}>
                    {organization.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="case-status">Status</Label>
              <NativeSelect id="case-status" className="w-full" {...form.register("status")}>
                {caseStatuses.map((status) => (
                  <NativeSelectOption key={status} value={status}>
                    {status}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="case-risk">Risk</Label>
              <NativeSelect id="case-risk" className="w-full" {...form.register("riskLevel")}>
                {riskLevels.map((riskLevel) => (
                  <NativeSelectOption key={riskLevel} value={riskLevel}>
                    {riskLevel}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="case-assigned-to">Assigned To</Label>
              <NativeSelect id="case-assigned-to" className="w-full" {...form.register("assignedToId")}>
                <NativeSelectOption value="">Unassigned</NativeSelectOption>
                {(users.data ?? []).map((user) => (
                  <NativeSelectOption key={user.id} value={user.id}>
                    {user.name ?? user.email}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="case-summary">Summary</Label>
            <Textarea id="case-summary" {...form.register("summary")} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="case-incident">Incident Description</Label>
            <Textarea id="case-incident" {...form.register("incidentDescription")} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="case-notes">Case Notes</Label>
            <Textarea id="case-notes" {...form.register("notes")} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={createCase.isPending || !(careSeekers.data?.length ?? 0)}>
              {createCase.isPending ? "Creating..." : "Create Case"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
