"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuthStore } from "@/stores/auth/auth-store";

import { apiGet, apiPatch, apiPost, apiPut } from "./client";
import type {
  AppModule,
  AuditLog,
  CareSeeker,
  CaseRecord,
  HealthStatus,
  LoginResponse,
  Organization,
  Role,
  RolePermission,
  User,
  CreateCaseInput,
  CreateCareSeekerInput,
  CreateOrganizationInput,
} from "./types";

const API_PREFIX = "/api/v1";

export const queryKeys = {
  me: ["auth", "me"] as const,
  health: ["health"] as const,
  cases: ["cases"] as const,
  caseDetail: (id: string) => ["cases", id] as const,
  organizations: ["organizations"] as const,
  users: ["users"] as const,
  careSeekers: ["care-seekers"] as const,
  auditLogs: ["audit"] as const,
  modules: ["modules"] as const,
  roles: ["roles"] as const,
  rolePermissions: (roleId: string) => ["roles", roleId, "permissions"] as const,
};

export function useLoginMutation() {
  const queryClient = useQueryClient();
  const setSession = useAuthStore((state) => state.setSession);

  return useMutation({
    mutationFn: (body: { email: string; password: string }) => apiPost<LoginResponse>(`${API_PREFIX}/auth/login`, body),
    onSuccess: (session) => {
      setSession(session.accessToken, session.user);
      queryClient.setQueryData(queryKeys.me, session.user);
    },
  });
}

export function useMeQuery() {
  const token = useAuthStore((state) => state.accessToken);
  const setUser = useAuthStore((state) => state.setUser);
  const clearSession = useAuthStore((state) => state.clearSession);

  return useQuery({
    queryKey: queryKeys.me,
    queryFn: async () => {
      const response = await apiGet<{ user: LoginResponse["user"] }>(`${API_PREFIX}/auth/me`);
      setUser(response.user);
      return response.user;
    },
    enabled: Boolean(token),
    retry: false,
    staleTime: 60_000,
    throwOnError: false,
    meta: {
      onError: () => clearSession(),
    },
  });
}

export function useHealthQuery() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: () => apiGet<HealthStatus>("/health"),
    refetchInterval: 30_000,
  });
}

export function useCasesQuery() {
  return useQuery({ queryKey: queryKeys.cases, queryFn: () => apiGet<CaseRecord[]>(`${API_PREFIX}/cases`) });
}

export function useCreateCaseMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateCaseInput) => apiPost<CaseRecord, CreateCaseInput>(`${API_PREFIX}/cases`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cases });
    },
  });
}

export function useCaseQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.caseDetail(id),
    queryFn: () => apiGet<CaseRecord>(`${API_PREFIX}/cases/${id}`),
    enabled: Boolean(id),
  });
}

export function useOrganizationsQuery() {
  return useQuery({ queryKey: queryKeys.organizations, queryFn: () => apiGet<Organization[]>(`${API_PREFIX}/organizations`) });
}

export function useCreateOrganizationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateOrganizationInput) =>
      apiPost<Organization, CreateOrganizationInput>(`${API_PREFIX}/organizations`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations });
    },
  });
}

export function useUsersQuery() {
  return useQuery({ queryKey: queryKeys.users, queryFn: () => apiGet<User[]>(`${API_PREFIX}/users`) });
}

export function useCareSeekersQuery() {
  return useQuery({ queryKey: queryKeys.careSeekers, queryFn: () => apiGet<CareSeeker[]>(`${API_PREFIX}/care-seekers`) });
}

export function useCreateCareSeekerMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateCareSeekerInput) =>
      apiPost<CareSeeker, CreateCareSeekerInput>(`${API_PREFIX}/care-seekers`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.careSeekers });
    },
  });
}

export function useAuditLogsQuery() {
  return useQuery({ queryKey: queryKeys.auditLogs, queryFn: () => apiGet<AuditLog[]>(`${API_PREFIX}/audit`) });
}

export function useModulesQuery() {
  return useQuery({ queryKey: queryKeys.modules, queryFn: () => apiGet<AppModule[]>(`${API_PREFIX}/modules`) });
}

export function useToggleModuleMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (moduleId: string) => apiPatch<AppModule>(`${API_PREFIX}/modules/${moduleId}/toggle`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.modules });
      queryClient.invalidateQueries({ queryKey: queryKeys.me });
    },
  });
}

export function useRolesQuery() {
  return useQuery({ queryKey: queryKeys.roles, queryFn: () => apiGet<Role[]>(`${API_PREFIX}/roles`) });
}

export function useRolePermissionsQuery(roleId: string) {
  return useQuery({
    queryKey: queryKeys.rolePermissions(roleId),
    queryFn: () => apiGet<RolePermission[]>(`${API_PREFIX}/roles/${roleId}/permissions`),
    enabled: Boolean(roleId),
  });
}

export function useUpdateRolePermissionsMutation(roleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (permissions: Array<Omit<RolePermission, "id" | "roleId" | "moduleId" | "module"> & { moduleKey: string }>) =>
      apiPut<RolePermission[]>(`${API_PREFIX}/roles/${roleId}/permissions`, { permissions }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rolePermissions(roleId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.me });
    },
  });
}
