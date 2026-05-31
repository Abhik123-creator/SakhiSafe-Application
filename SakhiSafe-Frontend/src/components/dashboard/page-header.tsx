export function PageHeader({
  title,
  description,
}: Readonly<{
  title: string;
  description?: string;
}>) {
  return (
    <div className="mb-6">
      <h1 className="font-semibold text-2xl tracking-tight">{title}</h1>
      {description && <p className="mt-1 text-muted-foreground text-sm">{description}</p>}
    </div>
  );
}
