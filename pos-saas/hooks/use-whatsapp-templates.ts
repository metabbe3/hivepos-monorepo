"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/modules/shared";
import type { TemplateOverrides } from "@/lib/whatsapp-templates";

// ponytail: module-scope cache so the fetch runs once per session, not per
// mount. 60s server TTL covers stale reads; manual refresh from settings page
// updates state directly. Invalidation on PATCH happens server-side.
let sessionCache: TemplateOverrides | null = null;

export function useWhatsappTemplates(): TemplateOverrides {
  const [templates, setTemplates] = useState<TemplateOverrides>(sessionCache ?? {});

  useEffect(() => {
    if (sessionCache) return;
    let alive = true;
    apiFetch<{ overrides: TemplateOverrides }>(
      "/api/tenant/whatsapp-templates",
    )
      .then((res) => {
        if (!alive) return;
        sessionCache = res.data.overrides;
        setTemplates(sessionCache);
      })
      .catch(() => {
        // Defaults flow through renderWhatsAppTemplate when no override.
      });
    return () => {
      alive = false;
    };
  }, []);

  return templates;
}

/** Force-refresh after a settings PATCH so the next mount re-fetches. */
export function invalidateWhatsappTemplatesCache(): void {
  sessionCache = null;
}
