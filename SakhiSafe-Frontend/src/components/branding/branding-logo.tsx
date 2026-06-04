"use client";

import { cn } from "@/lib/utils";
import { useBranding } from "@/lib/branding/use-branding";

export function BrandingLogo({ className }: Readonly<{ className?: string }>) {
  const branding = useBranding();

  return <img src={branding.logoUrl} alt={`${branding.siteName} logo`} className={cn("object-contain", className)} />;
}

export function BrandingName({ suffix, className }: Readonly<{ suffix?: string; className?: string }>) {
  const branding = useBranding();

  return <span className={className}>{suffix ? `${branding.siteName} ${suffix}` : branding.siteName}</span>;
}

export function BrandingCopyright({ className }: Readonly<{ className?: string }>) {
  const branding = useBranding();

  return <span className={className}>{`© ${new Date().getFullYear()}, ${branding.siteName}.`}</span>;
}
