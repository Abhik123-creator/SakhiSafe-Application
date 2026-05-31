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
import { useCreateOrganizationMutation } from "@/lib/api/queries";
import type { OrganizationType } from "@/lib/api/types";

const organizationTypes: OrganizationType[] = ["NGO", "GOVERNMENT", "ERT", "HEALTHCARE", "LEGAL", "POLICE", "SHELTER", "SYSTEM"];

const createOrganizationSchema = z.object({
  name: z.string().min(2, "Name is required"),
  type: z.enum(organizationTypes),
  phone: z.string().optional(),
  address: z.string().optional(),
});

type CreateOrganizationValues = z.infer<typeof createOrganizationSchema>;

function cleanOptional(value?: string) {
  return value?.trim() ? value.trim() : undefined;
}

export function CreateOrganizationDialog() {
  const [open, setOpen] = useState(false);
  const createOrganization = useCreateOrganizationMutation();
  const form = useForm<CreateOrganizationValues>({
    resolver: zodResolver(createOrganizationSchema),
    defaultValues: { name: "", type: "NGO", phone: "", address: "" },
  });

  const onSubmit = form.handleSubmit((values) => {
    createOrganization.mutate(
      {
        name: values.name.trim(),
        type: values.type,
        phone: cleanOptional(values.phone),
        address: cleanOptional(values.address),
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
          Create Organization
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Organization</DialogTitle>
          <DialogDescription>Add a partner or response organization.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={onSubmit}>
          {createOrganization.isError && <ErrorState message={createOrganization.error.message} />}
          <div className="grid gap-2">
            <Label htmlFor="organization-name">Name</Label>
            <Input id="organization-name" {...form.register("name")} />
            {form.formState.errors.name && <p className="text-destructive text-xs">{form.formState.errors.name.message}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="organization-type">Type</Label>
            <NativeSelect id="organization-type" className="w-full" {...form.register("type")}>
              {organizationTypes.map((type) => (
                <NativeSelectOption key={type} value={type}>
                  {type}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="organization-phone">Phone</Label>
            <Input id="organization-phone" {...form.register("phone")} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="organization-address">Address</Label>
            <Textarea id="organization-address" {...form.register("address")} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={createOrganization.isPending}>
              {createOrganization.isPending ? "Creating..." : "Create Organization"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
