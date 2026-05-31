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
import { useCreateCareSeekerMutation, useOrganizationsQuery } from "@/lib/api/queries";
import type { RiskLevel } from "@/lib/api/types";

const riskLevels: RiskLevel[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

const createCareSeekerSchema = z.object({
  fullName: z.string().min(2, "Name is required"),
  organizationId: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  riskLevel: z.enum(riskLevels),
  safetyNotes: z.string().optional(),
});

type CreateCareSeekerValues = z.infer<typeof createCareSeekerSchema>;

function cleanOptional(value?: string) {
  return value?.trim() ? value.trim() : undefined;
}

export function CreateCareSeekerDialog() {
  const [open, setOpen] = useState(false);
  const organizations = useOrganizationsQuery();
  const createCareSeeker = useCreateCareSeekerMutation();
  const form = useForm<CreateCareSeekerValues>({
    resolver: zodResolver(createCareSeekerSchema),
    defaultValues: { fullName: "", organizationId: "", phone: "", address: "", riskLevel: "MEDIUM", safetyNotes: "" },
  });

  const onSubmit = form.handleSubmit((values) => {
    createCareSeeker.mutate(
      {
        fullName: values.fullName.trim(),
        organizationId: cleanOptional(values.organizationId),
        phone: cleanOptional(values.phone),
        address: cleanOptional(values.address),
        riskLevel: values.riskLevel,
        safetyNotes: cleanOptional(values.safetyNotes),
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
          Create Care Seeker
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Care Seeker</DialogTitle>
          <DialogDescription>Add a care seeker record with permission-controlled access.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={onSubmit}>
          {createCareSeeker.isError && <ErrorState message={createCareSeeker.error.message} />}
          <div className="grid gap-2">
            <Label htmlFor="care-seeker-name">Name</Label>
            <Input id="care-seeker-name" {...form.register("fullName")} />
            {form.formState.errors.fullName && <p className="text-destructive text-xs">{form.formState.errors.fullName.message}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="care-seeker-organization">Organization</Label>
            <NativeSelect id="care-seeker-organization" className="w-full" {...form.register("organizationId")}>
              <NativeSelectOption value="">None</NativeSelectOption>
              {(organizations.data ?? []).map((organization) => (
                <NativeSelectOption key={organization.id} value={organization.id}>
                  {organization.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="care-seeker-risk">Risk</Label>
            <NativeSelect id="care-seeker-risk" className="w-full" {...form.register("riskLevel")}>
              {riskLevels.map((riskLevel) => (
                <NativeSelectOption key={riskLevel} value={riskLevel}>
                  {riskLevel}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="care-seeker-phone">Phone</Label>
              <Input id="care-seeker-phone" {...form.register("phone")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="care-seeker-address">Address</Label>
              <Input id="care-seeker-address" {...form.register("address")} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="care-seeker-notes">Safety Notes</Label>
            <Textarea id="care-seeker-notes" {...form.register("safetyNotes")} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={createCareSeeker.isPending}>
              {createCareSeeker.isPending ? "Creating..." : "Create Care Seeker"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
