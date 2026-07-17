import {
  withErrorHandler,
  parseBody,
  apiSuccess,
  ValidationError,
} from "@/modules/shared";
import { requirePermissionOrThrow } from "@/lib/permissions/check";
import { prisma } from "@/lib/prisma";
import { whatsappTemplatesSchema } from "@/lib/validations";
import { invalidateTenantCache } from "@/lib/tenant-cache";
import {
  WHATSAPP_TEMPLATES,
  WHATSAPP_TEMPLATE_MAP,
  renderWhatsAppTemplate,
  type TemplateId,
  type TemplateOverrides,
} from "@/lib/whatsapp-templates";

// ponytail: WhatsApp templates live in Tenant.settings.whatsappTemplates.
// Reuses the website-settings pattern: billing:read for GET, billing:edit
// for PATCH. No Pro-tier gate — operational messaging applies to all plans.
// Cache invalidation via invalidateTenantCache; 60s TTL covers everything else.

interface SettingsShape {
  website?: Record<string, unknown>;
  whatsappTemplates?: TemplateOverrides;
}

function readOverrides(settings: unknown): TemplateOverrides {
  const s = settings as SettingsShape | null;
  return s?.whatsappTemplates ?? {};
}

function buildEffective(overrides: TemplateOverrides): Record<TemplateId, string> {
  // ponytail: render with empty vars just to apply the default-vs-override rule
  // — callers (UI) want to see the *effective* body to display in the textarea.
  const out = {} as Record<TemplateId, string>;
  for (const t of WHATSAPP_TEMPLATES) {
    out[t.id] = renderWhatsAppTemplate(t.id, {}, overrides);
  }
  return out;
}

function buildDefaults(): Record<TemplateId, string> {
  const out = {} as Record<TemplateId, string>;
  for (const t of WHATSAPP_TEMPLATES) {
    out[t.id] = t.defaultBody;
  }
  return out;
}

export const GET = withErrorHandler(async () => {
  const ctx = await requirePermissionOrThrow("billing", "read");
  const tenant = await prisma.tenant.findUnique({
    where: { id: ctx.tenantId },
    select: { settings: true },
  });
  if (!tenant) throw new ValidationError("Tenant not found");

  const overrides = readOverrides(tenant.settings);
  return apiSuccess({
    overrides,
    defaults: buildDefaults(),
    effective: buildEffective(overrides),
    manifest: WHATSAPP_TEMPLATES.map((t) => ({
      id: t.id,
      label: t.label,
      description: t.description,
      category: t.category,
      variables: t.variables,
      defaultBody: t.defaultBody,
      maxLength: t.maxLength,
    })),
  });
});

export const PATCH = withErrorHandler(async (req) => {
  const ctx = await requirePermissionOrThrow("billing", "edit");
  const input = await parseBody(req, whatsappTemplatesSchema);

  const tenant = await prisma.tenant.findUnique({
    where: { id: ctx.tenantId },
    select: { settings: true, slug: true },
  });
  if (!tenant) throw new ValidationError("Tenant not found");

  const existing = (tenant.settings as SettingsShape | null) ?? {};
  // Shallow-merge per-key: only keys present in the PATCH body are touched.
  // Empty-string = explicitly reset to default (override removed).
  const currentTemplates = existing.whatsappTemplates ?? {};
  const nextTemplates: TemplateOverrides = { ...currentTemplates };
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined) continue;
    const id = k as TemplateId;
    if (!WHATSAPP_TEMPLATE_MAP[id]) continue;
    if (typeof v === "string" && v.trim().length === 0) {
      delete nextTemplates[id];
    } else {
      nextTemplates[id] = v as string;
    }
  }

  const updatedSettings: SettingsShape = {
    ...existing,
    whatsappTemplates: nextTemplates,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await prisma.tenant.update({
    where: { id: ctx.tenantId },
    data: { settings: updatedSettings as any },
    select: { id: true },
  });

  invalidateTenantCache(tenant.slug);

  return apiSuccess({
    overrides: nextTemplates,
    effective: buildEffective(nextTemplates),
  });
});
