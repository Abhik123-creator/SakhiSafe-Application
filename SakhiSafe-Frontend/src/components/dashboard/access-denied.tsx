import { ShieldAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function AccessDenied() {
  return (
    <Alert variant="destructive">
      <ShieldAlert className="size-4" />
      <AlertTitle>403 Forbidden</AlertTitle>
      <AlertDescription>You do not have permission to view this module.</AlertDescription>
    </Alert>
  );
}
