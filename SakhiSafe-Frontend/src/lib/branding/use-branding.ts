"use client";

import { usePublicBrandingQuery } from "@/lib/api/queries";
import { mergeBranding, resolveBrandingAssetUrl } from "@/lib/branding/branding";

export function useBranding() {
  const brandingQuery = usePublicBrandingQuery();
  const branding = mergeBranding(brandingQuery.data);

  return {
    ...branding,
    logoUrl: resolveBrandingAssetUrl(branding.logoUrl),
    isLoading: brandingQuery.isLoading,
  };
}
