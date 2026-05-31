export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  meta?: Record<string, unknown>;
  requestId?: string;
}

export interface ApiErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
  };
  requestId?: string;
}

export interface Role {
  id: string;
  name: string;
  description?: string | null;
  createdAt?: string;
}

export interface UserRole {
  role: Role;
}

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  organizationId?: string | null;
  roles?: UserRole[];
  isActive?: boolean;
  createdAt?: string;
}

export interface Organization {
  id: string;
  name: string;
  type: string;
  phone?: string | null;
  address?: string | null;
  createdAt?: string;
}

export type OrganizationType = "NGO" | "GOVERNMENT" | "ERT" | "HEALTHCARE" | "LEGAL" | "POLICE" | "SHELTER" | "SYSTEM";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type CaseStatus = "OPEN" | "IN_PROGRESS" | "ESCALATED" | "RESOLVED" | "CLOSED";

export interface CareSeeker {
  id: string;
  fullName: string;
  phone?: string | null;
  address?: string | null;
  riskLevel: string;
  organizationId?: string | null;
  safetyNotes?: string | null;
  createdAt?: string;
}

export interface CaseRecord {
  id: string;
  title: string;
  summary?: string | null;
  notes?: string | null;
  incidentDescription?: string | null;
  status: string;
  riskLevel: string;
  careSeeker?: CareSeeker;
  organization?: Organization | null;
  assignedTo?: User | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuditLog {
  id: string;
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface HealthStatus {
  status: string;
  database: string;
  timestamp: string;
}

export interface CreateOrganizationInput {
  name: string;
  type: OrganizationType;
  phone?: string;
  address?: string;
}

export interface CreateCareSeekerInput {
  fullName: string;
  organizationId?: string;
  phone?: string;
  address?: string;
  riskLevel?: RiskLevel;
  safetyNotes?: string;
}

export interface CreateCaseInput {
  careSeekerId: string;
  title: string;
  organizationId?: string;
  assignedToId?: string;
  summary?: string;
  notes?: string;
  incidentDescription?: string;
  status?: CaseStatus;
  riskLevel?: RiskLevel;
}

export type RoleName = "SUPER_ADMIN" | "ADMIN" | "ORGANIZATION" | "CARE_SEEKER";

export type ModuleKey =
  | "DASHBOARD"
  | "USERS"
  | "ROLES"
  | "MODULES"
  | "ORGANIZATIONS"
  | "CARE_SEEKERS"
  | "CASES"
  | "MESSAGES"
  | "INCIDENTS"
  | "SAFETY_LOGS"
  | "EVIDENCE"
  | "RAG_DOCUMENTS"
  | "AUDIT_LOGS"
  | "SYSTEM_SETTINGS";

export type PermissionAction = "VIEW" | "CREATE" | "UPDATE" | "DELETE";

export interface UserPermission {
  moduleKey: ModuleKey;
  canView: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export interface AppModule {
  id: string;
  key: ModuleKey;
  name: string;
  description?: string | null;
  isEnabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface RolePermission {
  id?: string;
  roleId?: string;
  moduleId?: string;
  module?: AppModule;
  moduleKey?: ModuleKey;
  canView: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export interface AuthUser {
  id: string;
  email: string;
  fullName?: string;
  name?: string;
  roles: RoleName[];
  permissions: UserPermission[];
  enabledModules: ModuleKey[];
  organizationId?: string | null;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}
