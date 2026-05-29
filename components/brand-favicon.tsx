"use client";

import { useEffect } from "react";

type BrandPayload = {
  brand?: {
    logoUrl: string | null;
  };
};

export function BrandFavicon() {
  useEffect(() => {
    fetch("/api/brand")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: BrandPayload | null) => {
        updateBrandFavicon(payload?.brand?.logoUrl ?? null);
      })
      .catch(() => updateBrandFavicon(null));
  }, []);

  return null;
}

export function updateBrandFavicon(logoUrl: string | null) {
  if (typeof document === "undefined") {
    return;
  }

  const href = logoUrl ?? `/icon?v=${Date.now()}`;
  let link = document.querySelector<HTMLLinkElement>(
    'link[data-brand-favicon="true"]',
  );

  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    link.setAttribute("data-brand-favicon", "true");
    document.head.appendChild(link);
  }

  link.href = href;
}
