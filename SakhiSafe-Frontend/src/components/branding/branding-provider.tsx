"use client";

import { type ReactNode, useEffect } from "react";

import { useBranding } from "@/lib/branding/use-branding";

export function BrandingProvider({ children }: Readonly<{ children: ReactNode }>) {
  const branding = useBranding();

  useEffect(() => {
    document.title = branding.siteName;
    setIconLink("icon", branding.logoUrl);
    setIconLink("apple-touch-icon", branding.logoUrl);
  }, [branding.siteName, branding.logoUrl]);

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
