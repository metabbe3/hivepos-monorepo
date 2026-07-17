import {
  withErrorHandler,
  parseBody,
  apiSuccess,
  ValidationError,
} from "@/modules/shared";
import { requirePermissionOrThrow } from "@/lib/permissions/check";
import { prisma } from "@/lib/prisma";
import { websiteSettingsSchema } from "@/lib/validations";
import { invalidateTenantCache } from "@/lib/tenant-cache";
import { getTenantPlan } from "@/lib/billing";

// ponytail: website settings live in Tenant.settings.website. One GET, one
// PATCH. PATCH gates on Pro plan — only Pro tenants can edit/publish. Cache
// invalidation is via invalidateTenantCache; next subdomain read repopulates.

interface SettingsShape {
  website?: {
    tagline?: string;
    heroPhotoUrl?: string;
    about?: string;
    instagram?: string;
    qrisImageUrl?: string;
    // ponytail: Phase 2 — trust signals + repeatables.
    googleRating?: number;
    googleReviewCount?: number;
    yearEstablished?: number;
    avgProcessingMinutes?: number;
    areaServed?: string[];
    faqs?: Array<{ question: string; answer: string }>;
    testimonials?: Array<{
      name: string;
      role?: string;
      text: string;
      rating?: number;
    }>;
  };
}

export const GET = withErrorHandler(async () => {
  const ctx = await requirePermissionOrThrow("billing", "read");
  // Defense: if tenantId is missing, return empty rather than crashing Prisma
  // with "Argument `id` must not be null."
  if (!ctx.tenantId) {
    return apiSuccess({ plan: "FREE", slug: "", websiteEnabled: false, settings: {} });
  }
  const tenant = await prisma.tenant.findUnique({
    where: { id: ctx.tenantId },
    select: {
      slug: true,
      websiteEnabled: true,
      websitePublishedAt: true,
      settings: true,
    },
  });
  if (!tenant) throw new ValidationError("Tenant not found");

  const plan = await getTenantPlan(ctx.tenantId);
  const settings = (tenant.settings as SettingsShape | null)?.website ?? {};

  return apiSuccess({
    plan,
    slug: tenant.slug,
    websiteEnabled: tenant.websiteEnabled,
    websitePublishedAt: tenant.websitePublishedAt,
    subdomain: `${tenant.slug}.hivepos.id`,
    settings,
  });
});

export const PATCH = withErrorHandler(async (req) => {
  const ctx = await requirePermissionOrThrow("billing", "edit");
  const input = await parseBody(req, websiteSettingsSchema);

  const plan = await getTenantPlan(ctx.tenantId);
  if (plan !== "PRO") {
    throw new ValidationError(
      "Website adalah fitur Pro. Upgrade ke Pro untuk mengaktifkan website laundry Anda.",
    );
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: ctx.tenantId },
    select: { settings: true, slug: true, websiteEnabled: true },
  });
  if (!tenant) throw new ValidationError("Tenant not found");

  const existing = (tenant.settings as SettingsShape | null) ?? {};
  const updatedSettings: SettingsShape = {
    ...existing,
    website: {
      ...(existing.website ?? {}),
      ...Object.fromEntries(
        Object.entries(input).filter(([, v]) => v !== undefined),
      ),
    },
  };

  // ponytail: first-time publish flips websiteEnabled + sets websitePublishedAt.
  // Unpublish is a separate explicit action via DELETE below — keeps PATCH
  // semantically a content-only update. Cast bypasses Prisma's finicky JSON
  // input type — the runtime value is plain JSON-serialisable data.
  const now = new Date();
  const updated = await prisma.tenant.update({
    where: { id: ctx.tenantId },
    data: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      settings: updatedSettings as any,
      websiteEnabled: true,
      websitePublishedAt: tenant.websiteEnabled ? undefined : now,
    },
    select: {
      slug: true,
      websiteEnabled: true,
      websitePublishedAt: true,
      settings: true,
    },
  });

  invalidateTenantCache(updated.slug);

  return apiSuccess({
    plan,
    slug: updated.slug,
    websiteEnabled: updated.websiteEnabled,
    websitePublishedAt: updated.websitePublishedAt,
    subdomain: `${updated.slug}.hivepos.id`,
    settings: (updated.settings as SettingsShape).website ?? {},
  });
});

export const DELETE = withErrorHandler(async () => {
  const ctx = await requirePermissionOrThrow("billing", "edit");
  const tenant = await prisma.tenant.findUnique({
    where: { id: ctx.tenantId },
    select: { slug: true },
  });
  if (!tenant) throw new ValidationError("Tenant not found");

  await prisma.tenant.update({
    where: { id: ctx.tenantId },
    data: { websiteEnabled: false },
    select: { id: true },
  });

  invalidateTenantCache(tenant.slug);
  return apiSuccess({ websiteEnabled: false });
});
