import { APP_CONFIG } from "@/config/app-config";
import type { PublicBranding } from "@/lib/api/types";

const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export const FALLBACK_BRANDING: PublicBranding = {
  siteName: APP_CONFIG.name,
  logoUrl: APP_CONFIG.branding.logoPath,
};

export function resolveBrandingAssetUrl(url?: string | null): string {
  if (!url) {
    return FALLBACK_BRANDING.logoUrl ?? "/logo.jpeg";
  }

  if (/^(data:|https?:\/\/|blob:)/i.test(url)) {
    return url;
  }

  return url.startsWith("/uploads/") ? `${API_ORIGIN}${url}` : url;
}

export function mergeBranding(branding?: PublicBranding | null): PublicBranding {
  return {
    siteName: branding?.siteName?.trim() || FALLBACK_BRANDING.siteName,
    logoUrl: branding?.logoUrl?.trim() || FALLBACK_BRANDING.logoUrl,
  };
}
