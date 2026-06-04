"use client";

import { useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, UserPlus } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { ErrorState } from "@/components/dashboard/page-state";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useCreateUserMutation, useOrganizationsQuery } from "@/lib/api/queries";
import type { RoleName } from "@/lib/api/types";

const roleOptions: RoleName[] = ["ORGANIZATION", "CARE_SEEKER", "ADMIN", "SUPER_ADMIN"];

const createUserSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  fullName: z.string().min(2, "Full name is required"),
  phone: z.string().optional(),
  organizationId: z.string().optional(),
  role: z.enum(roleOptions),
});

type CreateUserValues = z.infer<typeof createUserSchema>;

function cleanOptional(value?: string) {
  return value?.trim() ? value.trim() : undefined;
}

export function CreateUserDialog() {
  const [open, setOpen] = useState(false);
  const [createdAccessMail, setCreatedAccessMail] = useState<string>();
  const organizations = useOrganizationsQuery();
  const createUser = useCreateUserMutation();
  const form = useForm<CreateUserValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      email: "",
      password: "",
      fullName: "",
      phone: "",
      organizationId: "",
      role: "ORGANIZATION",
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    setCreatedAccessMail(undefined);
    createUser.mutate(
      {
        email: values.email.trim(),
        password: values.password,
        fullName: values.fullName.trim(),
        phone: cleanOptional(values.phone),
        organizationId: cleanOptional(values.organizationId),
        roles: [values.role],
      },
      {
        onSuccess: (createdUser) => {
          form.reset({
            email: "",
            password: "",
            fullName: "",
            phone: "",
            organizationId: "",
            role: "ORGANIZATION",
          });
          setCreatedAccessMail(
            values.role === "ADMIN" || values.role === "SUPER_ADMIN" ? undefined : createdUser.email,
          );
        },
      },
    );
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setCreatedAccessMail(undefined);
          form.reset();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="size-4" />
          Add User
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add User</DialogTitle>
          <DialogDescription>Create an account and assign its primary role.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={onSubmit}>
          {createUser.isError && <ErrorState message={createUser.error.message} />}
          {createdAccessMail && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
              <div className="font-medium text-emerald-800">Evidence access code email queued</div>
              <p className="mt-2 text-emerald-900/80">
                The code was sent to {createdAccessMail}. In local development, review the captured email at NestLens mail.
              </p>
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="user-full-name">Full name</Label>
              <Input id="user-full-name" autoComplete="name" {...form.register("fullName")} />
              {form.formState.errors.fullName && <p className="text-destructive text-xs">{form.formState.errors.fullName.message}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-email">Email</Label>
              <Input id="user-email" autoComplete="email" type="email" {...form.register("email")} />
              {form.formState.errors.email && <p className="text-destructive text-xs">{form.formState.errors.email.message}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-password">Temporary password</Label>
              <Input id="user-password" autoComplete="new-password" type="password" {...form.register("password")} />
              {form.formState.errors.password && <p className="text-destructive text-xs">{form.formState.errors.password.message}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-phone">Phone</Label>
              <Input id="user-phone" autoComplete="tel" {...form.register("phone")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-role">Role</Label>
              <NativeSelect id="user-role" className="w-full" {...form.register("role")}>
                {roleOptions.map((role) => (
                  <NativeSelectOption key={role} value={role}>
                    {role}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-organization">Organization</Label>
              <NativeSelect id="user-organization" className="w-full" {...form.register("organizationId")}>
                <NativeSelectOption value="">None</NativeSelectOption>
                {(organizations.data ?? []).map((organization) => (
                  <NativeSelectOption key={organization.id} value={organization.id}>
                    {organization.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={createUser.isPending}>
              <Plus className="size-4" />
              {createUser.isPending ? "Creating..." : "Create User"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
