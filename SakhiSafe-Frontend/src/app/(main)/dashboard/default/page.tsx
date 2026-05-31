import { ModuleRouteGuard } from "@/lib/auth/module-route-guard";

export default function Page() {
  return (
    <ModuleRouteGuard moduleKey="DASHBOARD">
      <div className="space-y-6">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">SakhiSafe Overview</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Initial dashboard shell connected to the NestJS API. Replace these panels as backend analytics mature.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border p-4">
          <div className="text-muted-foreground text-sm">Cases</div>
          <div className="mt-2 font-semibold text-2xl">Live API</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-muted-foreground text-sm">Care Seekers</div>
          <div className="mt-2 font-semibold text-2xl">Protected</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-muted-foreground text-sm">System</div>
          <div className="mt-2 font-semibold text-2xl">Monitored</div>
        </div>
      </div>
      </div>
    </ModuleRouteGuard>
  );
}
