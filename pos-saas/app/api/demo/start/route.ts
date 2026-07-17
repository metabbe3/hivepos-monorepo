import { withErrorHandler, apiSuccess, ValidationError } from "@/modules/shared";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { TRIAL_DAYS } from "@/lib/billing";
import { seedDefaultRoles, backfillUserRoles } from "@/lib/permissions/seed";
import { DEFAULT_PICKUP_SLOTS } from "@/lib/pickup-slots";
import { seedSandbox } from "@/lib/demo/sandbox";

const DEMO_TTL_MS = 24 * 60 * 60 * 1000; // 24h

const bodySchema = z.object({
  // Lead-capture only — NOT verified, NOT used for auth (synthetic email below).
  email: z.string().email().optional().or(z.literal("")),
});

function randSuffix() {
  return Math.random().toString(36).slice(2, 8);
}

export const POST = withErrorHandler(async (req) => {
  // IP rate-limit: 5 demos/hour/IP — deters spam/scraping.
  // ponytail: in-memory limiter (lib/rate-limit.ts); Redis if we scale replicas.
  rateLimit(req, { limit: 5, windowSeconds: 3600 });

  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError("Email tidak valid.");
  }
  const leadEmail = parsed.data.email?.trim() || null;

  // Lazy cleanup: drop expired demo tenants (cascade removes branches/users/orders).
  const now = new Date();
  await prisma.tenant.deleteMany({
    where: { isDemo: true, demoExpiresAt: { lt: now } },
  });

  // Unique demo slug (pre-check avoids a rare tx rollback).
  let slug = `demo-${randSuffix()}`;
  while (await prisma.tenant.findUnique({ where: { slug } })) {
    slug = `demo-${randSuffix()}`;
  }

  const freePlan = await prisma.plan.findFirst({ where: { name: "Free" } });
  const trialEndsAt = new Date(now.getTime() + TRIAL_DAYS * 86_400_000);
  // Demo user password — random, returned to the client for auto-signin.
  const rawPassword = Math.random().toString(36).slice(2) + now.getTime().toString(36);
  const passwordHash = await bcrypt.hash(rawPassword, 12);

  const result = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        name: "Demo Laundry",
        slug,
        // Lead email captured on the tenant (synthetic email lives on the User).
        ownerEmail: leadEmail ?? `demo+${randSuffix()}@hivepos.id`,
        ownerName: "Pengguna Demo",
        activeModules: ["laundry"],
        isActive: true,
        approvedAt: now,
        // Demo visitors skip the onboarding wizard — land straight on the dashboard.
        onboardingCompletedAt: now,
        trialEndsAt,
        trialTier: "PRO",
        isDemo: true,
        demoExpiresAt: new Date(now.getTime() + DEMO_TTL_MS),
      },
    });

    const branch = await tx.branch.create({
      data: {
        name: "Outlet Demo",
        tenantId: tenant.id,
        isFreeTier: true,
        slug: `${slug}-outlet`,
        pickupSlots: [...DEFAULT_PICKUP_SLOTS],
      },
    });

    // Synthetic email avoids collision with real accounts + authorize() checks.
    await tx.user.create({
      data: {
        email: `demo-${tenant.id.slice(0, 8)}@demo.hivepos.local`,
        passwordHash,
        name: "Pengguna Demo",
        role: "OWNER",
        tenantId: tenant.id,
        branchId: branch.id,
      },
    });

    const roleMap = await seedDefaultRoles(tx, tenant.id);
    await backfillUserRoles(tx, tenant.id, roleMap);

    if (freePlan) {
      await tx.subscription.create({
        data: { tenantId: tenant.id, planId: freePlan.id, status: "TRIAL", currentPeriodEnd: trialEndsAt },
      });
    }

    // Pre-seed realistic sample data (customers, services, orders) on the branch.
    await seedSandbox(tx, branch.id);

    return tenant;
  });

  return apiSuccess({
    email: `demo-${result.id.slice(0, 8)}@demo.hivepos.local`,
    password: rawPassword,
  });
});
