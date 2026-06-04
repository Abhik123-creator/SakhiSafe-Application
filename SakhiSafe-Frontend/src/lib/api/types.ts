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
  evidenceAccessCodeIssuedAt?: string | null;
  oneTimeEvidenceAccessCode?: string;
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

export type IncidentSource = "WHATSAPP" | "WEB" | "ADMIN";

export type IncidentCategory =
  | "DOMESTIC_VIOLENCE"
  | "PHYSICAL_ABUSE"
  | "EMOTIONAL_ABUSE"
  | "SEXUAL_ABUSE"
  | "FINANCIAL_ABUSE"
  | "STALKING"
  | "HARASSMENT"
  | "THREAT"
  | "OTHER"
  | "UNKNOWN";

export type IncidentSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "UNKNOWN";

export type IncidentUrgency = "LOW" | "SOON" | "URGENT" | "IMMEDIATE" | "UNKNOWN";

export type IncidentStatus = "DRAFT" | "OPEN" | "UNDER_REVIEW" | "CLOSED";

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

export interface ConversationSession {
  id: string;
  careSeekerId: string;
  channel: "WHATSAPP" | "WEB";
  status: "ACTIVE" | "CLOSED";
  startedAt: string;
  lastMessageAt: string;
}

export interface ConversationMessage {
  id: string;
  sessionId: string;
  direction: "INBOUND" | "OUTBOUND";
  messageType: "TEXT" | "IMAGE";
  messageText?: string | null;
  mediaId?: string | null;
  evidenceId?: string | null;
  rawPayload?: Record<string, unknown> | null;
  createdAt: string;
}

export interface EvidenceListItem {
  id: string;
  evidenceType: "IMAGE";
  mimeType: string;
  fileSize: number;
  caption?: string | null;
  description?: string | null;
  aiSummary?: string | null;
  aiConfidence?: number | null;
  aiAnalysisStatus?: string | null;
  createdAt: string;
  uploadedBy: "CARE_SEEKER" | "ADMIN" | "AI_SERVICE";
}

export interface IncidentListItem {
  id: string;
  title: string;
  careSeekerPhoneNumber?: string | null;
  category: IncidentCategory;
  severity: IncidentSeverity;
  urgency: IncidentUrgency;
  status: IncidentStatus;
  needsHumanReview: boolean;
  aiGenerated: boolean;
  updatedAt: string;
}

export interface IncidentFilters {
  status?: IncidentStatus;
  severity?: IncidentSeverity;
  urgency?: IncidentUrgency;
  needsHumanReview?: boolean;
  source?: IncidentSource;
}

export interface IncidentDetail {
  id: string;
  careSeekerId: string;
  sessionId?: string | null;
  source: IncidentSource;
  title: string;
  summary?: string | null;
  description?: string | null;
  category: IncidentCategory;
  severity: IncidentSeverity;
  urgency: IncidentUrgency;
  incidentDateText?: string | null;
  locationText?: string | null;
  perpetratorRelation?: string | null;
  riskSignals?: string[] | null;
  missingFields?: string[] | null;
  needsHumanReview: boolean;
  aiGenerated: boolean;
  aiConfidence?: string | number | null;
  caseNote?: string | null;
  status: IncidentStatus;
  manuallyEdited?: boolean;
  createdAt: string;
  updatedAt: string;
  careSeeker?: {
    id: string;
    displayName?: string | null;
    phoneNumber?: string | null;
    whatsappPhoneNumber?: string | null;
    source?: string;
    status?: string;
  } | null;
  conversationSession?: ConversationSession | null;
  conversationMessagesTimeline?: ConversationMessage[];
  evidence?: EvidenceListItem[];
}

export interface UpdateIncidentInput {
  title?: string;
  summary?: string;
  description?: string;
  category?: IncidentCategory;
  severity?: IncidentSeverity;
  urgency?: IncidentUrgency;
  status?: IncidentStatus;
  caseNote?: string;
  needsHumanReview?: boolean;
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

export interface SystemSettings {
  branding: {
    siteName: string;
    logoUrl?: string;
  };
  smtp: {
    host: string;
    port: number;
    fromEmail: string;
    fromName: string;
    username: string;
    useTls: boolean;
    passwordConfigured: boolean;
  };
  security: {
    sessionTtlSeconds: number;
    auditLoggingEnabled: boolean;
  };
}

export type PublicBranding = SystemSettings["branding"];

export type UpdateSystemSettingsInput = Partial<{
  branding: Partial<SystemSettings["branding"]>;
  smtp: Partial<Omit<SystemSettings["smtp"], "passwordConfigured">> & { password?: string };
  security: Partial<SystemSettings["security"]>;
}>;

export interface SystemInfo {
  appName: string;
  environment: string;
  nodeVersion: string;
  uptimeSeconds: number;
  timestamp: string;
}

export type SystemMaintenanceAction = "CLEAR_CACHE" | "FIX_FILE_PERMISSIONS" | "BACKUP_DATABASE";

export interface SystemMaintenanceResult {
  action: SystemMaintenanceAction;
  status: string;
  message: string;
  requestedAt: string;
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

export interface CreateUserInput {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  organizationId?: string;
  roles?: RoleName[];
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
