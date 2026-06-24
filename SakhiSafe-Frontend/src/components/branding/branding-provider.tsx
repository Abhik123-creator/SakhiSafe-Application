"use client";

import { type ReactNode, useEffect } from "react";

import { useBranding } from "@/lib/branding/use-branding";
import { APP_CONFIG } from "@/config/app-config";

export function BrandingProvider({ children }: Readonly<{ children: ReactNode }>) {
  const branding = useBranding();

  useEffect(() => {
    document.title = branding.siteName;
    setIconLink("icon", APP_CONFIG.branding.faviconPath);
    setIconLink("apple-touch-icon", APP_CONFIG.branding.faviconPath);
  }, [branding.siteName]);

  return children;
}

function setIconLink(rel: string, href: string) {
  const selector = `link[rel="${rel}"]`;
  let link = document.head.querySelector<HTMLLinkElement>(selector);
  if (!link) {
    link = document.createElement("link");
    link.rel = rel;
    document.head.appendChild(link);
  }
  link.href = href;
}
