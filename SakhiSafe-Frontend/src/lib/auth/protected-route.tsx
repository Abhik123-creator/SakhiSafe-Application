"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";

import { Spinner } from "@/components/ui/spinner";
import { useMeQuery } from "@/lib/api/queries";
import { useAuthStore } from "@/stores/auth/auth-store";

export function ProtectedRoute({ children }: Readonly<{ children: ReactNode }>) {
  const router = useRouter();
  const token = useAuthStore((state) => state.accessToken);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const { isLoading, isError } = useMeQuery();

  useEffect(() => {
    if (hasHydrated && (!token || isError)) {
      router.replace("/auth/v1/login");
    }
  }, [hasHydrated, isError, router, token]);

  if (!hasHydrated || (token && isLoading)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!token || isError) {
    return null;
  }

  return children;
}
