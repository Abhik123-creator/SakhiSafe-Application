"use client";

import type { ReactNode } from "react";

import { AccessDenied } from "@/components/dashboard/access-denied";
import type { ModuleKey } from "@/lib/api/types";
import { can } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth/auth-store";

export function ModuleRouteGuard({ moduleKey, children }: Readonly<{ moduleKey: ModuleKey; children: ReactNode }>) {
  const user = useAuthStore((state) => state.user);

  if (!can(user, moduleKey, "VIEW")) {
    return <AccessDenied />;
  }

  return children;
}
