import { AlertCircle, Inbox } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";

export function LoadingState({ label = "Loading data" }: Readonly<{ label?: string }>) {
  return (
    <div className="flex min-h-64 items-center justify-center gap-3 text-muted-foreground">
      <Spinner />
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({ message = "Unable to load data." }: Readonly<{ message?: string }>) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="size-4" />
      <AlertTitle>Request failed</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

export function EmptyState({ title = "No records found" }: Readonly<{ title?: string }>) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-muted-foreground">
      <Inbox className="size-8" />
      <p className="font-medium text-foreground">{title}</p>
    </div>
  );
}
