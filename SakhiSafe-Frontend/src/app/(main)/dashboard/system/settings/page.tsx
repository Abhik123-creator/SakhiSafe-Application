"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AccessDenied } from "@/components/dashboard/access-denied";
import { PageHeader } from "@/components/dashboard/page-header";
import { ErrorState, LoadingState } from "@/components/dashboard/page-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  useSystemInfoQuery,
  useSystemMaintenanceMutation,
  useSystemSettingsQuery,
  useUpdateSystemSettingsMutation,
} from "@/lib/api/queries";
import type { SystemMaintenanceAction, UpdateSystemSettingsInput } from "@/lib/api/types";
import { ModuleRouteGuard } from "@/lib/auth/module-route-guard";
import { can } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth/auth-store";

type FormState = {
  siteName: string;
  logoUrl: string;
  smtpHost: string;
  smtpPort: number;
  smtpFromEmail: string;
  smtpFromName: string;
  smtpUsername: string;
  smtpPassword: string;
  smtpUseTls: boolean;
  sessionTtlSeconds: number;
  auditLoggingEnabled: boolean;
};

const maintenanceActions: Array<{ action: SystemMaintenanceAction; label: string }> = [
  { action: "CLEAR_CACHE", label: "Clear Cache" },
  { action: "FIX_FILE_PERMISSIONS", label: "Fix File Permissions" },
  { action: "BACKUP_DATABASE", label: "Request Database Backup" },
];

export default function SystemSettingsPage() {
  const user = useAuthStore((state) => state.user);
  const settingsQuery = useSystemSettingsQuery();
  const infoQuery = useSystemInfoQuery();
  const updateSettings = useUpdateSystemSettingsMutation();
  const maintenance = useSystemMaintenanceMutation();
  const [form, setForm] = useState<FormState | null>(null);

  useEffect(() => {
    if (!settingsQuery.data) {
      return;
    }

    setForm({
      siteName: settingsQuery.data.branding.siteName,
      logoUrl: settingsQuery.data.branding.logoUrl ?? "",
      smtpHost: settingsQuery.data.smtp.host,
      smtpPort: settingsQuery.data.smtp.port,
      smtpFromEmail: settingsQuery.data.smtp.fromEmail,
      smtpFromName: settingsQuery.data.smtp.fromName,
      smtpUsername: settingsQuery.data.smtp.username,
      smtpPassword: "",
      smtpUseTls: settingsQuery.data.smtp.useTls,
      sessionTtlSeconds: settingsQuery.data.security.sessionTtlSeconds,
      auditLoggingEnabled: settingsQuery.data.security.auditLoggingEnabled,
    });
  }, [settingsQuery.data]);

  if (!can(user, "SYSTEM_SETTINGS", "VIEW")) {
    return <AccessDenied />;
  }

  if (settingsQuery.isLoading || !form) {
    return <LoadingState label="Loading system settings" />;
  }

  if (settingsQuery.isError) {
    return <ErrorState message={settingsQuery.error.message} />;
  }

  const canUpdate = can(user, "SYSTEM_SETTINGS", "UPDATE");

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  }

  function saveSettings() {
    if (!form) {
      return;
    }

    const currentForm = form;
    const payload: UpdateSystemSettingsInput = {
      branding: {
        siteName: currentForm.siteName,
        logoUrl: currentForm.logoUrl,
      },
      smtp: {
        host: currentForm.smtpHost,
        port: Number(currentForm.smtpPort),
        fromEmail: currentForm.smtpFromEmail,
        fromName: currentForm.smtpFromName,
        username: currentForm.smtpUsername,
        useTls: currentForm.smtpUseTls,
        ...(currentForm.smtpPassword.trim() ? { password: currentForm.smtpPassword } : {}),
      },
      security: {
        sessionTtlSeconds: Number(currentForm.sessionTtlSeconds),
        auditLoggingEnabled: currentForm.auditLoggingEnabled,
      },
    };

    updateSettings.mutate(payload, {
      onSuccess: () => {
        setField("smtpPassword", "");
        toast.success("System settings updated");
      },
      onError: (error) => toast.error(error.message),
    });
  }

  function requestMaintenance(action: SystemMaintenanceAction) {
    maintenance.mutate(action, {
      onSuccess: (result) => toast.success(result.message),
      onError: (error) => toast.error(error.message),
    });
  }

  return (
    <ModuleRouteGuard moduleKey="SYSTEM_SETTINGS">
      <PageHeader title="System Settings" description="Super admin controls for branding, email, security, and maintenance." />

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Branding</CardTitle>
            <CardDescription>Controls app shell and authentication screen identity.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm">
              <span className="font-medium">Site Name</span>
              <Input disabled={!canUpdate} value={form.siteName} onChange={(event) => setField("siteName", event.target.value)} />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="font-medium">Logo URL</span>
              <Input disabled={!canUpdate} value={form.logoUrl} onChange={(event) => setField("logoUrl", event.target.value)} />
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Security</CardTitle>
            <CardDescription>Session and audit behavior for the dashboard.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <label className="grid gap-2 text-sm">
              <span className="font-medium">Session TTL Seconds</span>
              <Input
                disabled={!canUpdate}
                min={300}
                max={86400}
                type="number"
                value={form.sessionTtlSeconds}
                onChange={(event) => setField("sessionTtlSeconds", Number(event.target.value))}
              />
            </label>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium text-sm">Audit Logging</p>
                <p className="text-muted-foreground text-xs">Keep privileged changes in the audit trail.</p>
              </div>
              <Switch
                checked={form.auditLoggingEnabled}
                disabled={!canUpdate}
                onCheckedChange={(checked) => setField("auditLoggingEnabled", checked)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Email SMTP</CardTitle>
            <CardDescription>SMTP password is write-only and never returned by the API.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm">
              <span className="font-medium">Host</span>
              <Input disabled={!canUpdate} value={form.smtpHost} onChange={(event) => setField("smtpHost", event.target.value)} />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="font-medium">Port</span>
              <Input
                disabled={!canUpdate}
                min={1}
                max={65535}
                type="number"
                value={form.smtpPort}
                onChange={(event) => setField("smtpPort", Number(event.target.value))}
              />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="font-medium">From Email</span>
              <Input
                disabled={!canUpdate}
                type="email"
                value={form.smtpFromEmail}
                onChange={(event) => setField("smtpFromEmail", event.target.value)}
              />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="font-medium">From Name</span>
              <Input disabled={!canUpdate} value={form.smtpFromName} onChange={(event) => setField("smtpFromName", event.target.value)} />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="font-medium">Username</span>
              <Input disabled={!canUpdate} value={form.smtpUsername} onChange={(event) => setField("smtpUsername", event.target.value)} />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="font-medium">Password</span>
              <Input
                disabled={!canUpdate}
                placeholder={settingsQuery.data?.smtp.passwordConfigured ? "Configured" : "Not configured"}
                type="password"
                value={form.smtpPassword}
                onChange={(event) => setField("smtpPassword", event.target.value)}
              />
            </label>
            <div className="flex items-center justify-between rounded-lg border p-3 md:col-span-2">
              <div>
                <p className="font-medium text-sm">Use TLS</p>
                <p className="text-muted-foreground text-xs">Enable encrypted SMTP transport.</p>
              </div>
              <Switch checked={form.smtpUseTls} disabled={!canUpdate} onCheckedChange={(checked) => setField("smtpUseTls", checked)} />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>System Info</CardTitle>
              <CardDescription>Sanitized runtime details. Secrets and environment values are not exposed.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              {infoQuery.data ? (
                <>
                  <InfoRow label="App" value={infoQuery.data.appName} />
                  <InfoRow label="Environment" value={infoQuery.data.environment} />
                  <InfoRow label="Node" value={infoQuery.data.nodeVersion} />
                  <InfoRow label="Uptime" value={`${infoQuery.data.uptimeSeconds}s`} />
                </>
              ) : (
                <p className="text-muted-foreground">Loading system info...</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Maintenance</CardTitle>
              <CardDescription>Privileged requests are audited and do not execute shell commands directly.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {maintenanceActions.map((item) => (
                <Button
                  key={item.action}
                  disabled={!canUpdate || maintenance.isPending}
                  variant="outline"
                  onClick={() => requestMaintenance(item.action)}
                >
                  {item.label}
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Button disabled={!canUpdate || updateSettings.isPending} onClick={saveSettings}>
          {updateSettings.isPending ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </ModuleRouteGuard>
  );
}

function InfoRow({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
