import { withErrorHandler, apiSuccess, ValidationError, ConflictError } from "@/modules/shared";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import { z } from "zod";
import { seedDefaultRoles, backfillUserRoles } from "@/lib/permissions/seed";
import { rateLimit } from "@/lib/rate-limit";
import { TRIAL_DAYS } from "@/lib/billing";
import { generateUniqueReferralCode, attachReferral } from "@/lib/referrals";
import { DEFAULT_PICKUP_SLOTS } from "@/lib/pickup-slots";

const registerSchema = z.object({
  businessName: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  branchName: z.string().min(1),
  ownerName: z.string().min(2),
  ownerPhone: z.string().optional(),
  email: z.string().email(),
  password: z.string().min(6).optional().or(z.literal("")),
  googleId: z.string().optional(),
  /// Which tier to trial: "PRO" (default — full features for 14 days) or "GROWTH".
  trialTier: z.enum(["GROWTH", "PRO"]).optional(),
  /// Referral code from /register?ref=CODE (optional). Links the new tenant to
  /// a referrer; reward unlocks on the new tenant's first paid payment.
  referralCode: z.string().optional(),
});

export const POST = withErrorHandler(async (req) => {
  rateLimit(req, { limit: 5, windowSeconds: 60 });

  const body = await req.json();
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues[0]?.message ?? "Data tidak valid",
      { details: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })) },
    );
  }
  const data = parsed.data;

  // Check if slug is taken
  const existingTenant = await prisma.tenant.findUnique({
    where: { slug: data.slug },
  });
  if (existingTenant) {
    throw new ConflictError("Subdomain sudah digunakan. Pilih yang lain.");
  }

  // Check if email is taken
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email },
  });
  if (existingUser) {
    throw new ConflictError("Email sudah terdaftar. Gunakan email lain.");
  }

  // Get the Free plan
  const freePlan = await prisma.plan.findFirst({
    where: { name: "Free" },
  });

  // Generate a unique referral code for the new tenant up-front (the @unique
  // guard is the real collision backstop; pre-check avoids a rare tx rollback).
  const referralCode = await generateUniqueReferralCode();

  // Create tenant + branch + owner + subscription in a transaction
  const result = await prisma.$transaction(async (tx) => {
    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + TRIAL_DAYS * 86_400_000);
    // Auto-activated at signup — no admin approval. Honors the landing "Live dalam
    // 2 menit / langsung jalan" claim and grants the 14-day Growth/Pro trial now.
    const tenant = await tx.tenant.create({
      data: {
        name: data.businessName,
        slug: data.slug,
        ownerEmail: data.email,
        ownerName: data.ownerName,
        ownerPhone: data.ownerPhone,
        activeModules: ["laundry"],
        isActive: true,
        approvedAt: now,
        trialEndsAt,
        trialTier: data.trialTier ?? "PRO",
        referralCode,
      },
    });

    // Create default branch. Seed a public slug + the default pickup schedule so
    // /pickup/[slug] works out of the box (previously silent: no slots offered).
    // Reuse the (globally-unique) tenant slug; on the rare collision with an
    // existing branch slug (e.g. the demo seed), suffix with a slice of tenant id.
    let branchSlug = data.slug;
    if (await tx.branch.findUnique({ where: { slug: branchSlug } })) {
      branchSlug = `${data.slug}-${tenant.id.slice(0, 6)}`;
    }
    // ponytail: isFreeTier=true so the order guard doesn't block newly-approved
    // free-tier tenants (branch with isFreeTier=false + coverageEnd=null is treated
    // as LOCKED by create-order.service.ts). Flipped to false + coverageEnd set on
    // first payment via extendOutletCoverage().
    const branch = await tx.branch.create({
      data: {
        name: data.branchName,
        tenantId: tenant.id,
        isFreeTier: true,
        slug: branchSlug,
        pickupSlots: [...DEFAULT_PICKUP_SLOTS],
      },
    });

    // Create owner user
    // Google OAuth users get a random password (they login via Google)
    const rawPassword = data.password || Math.random().toString(36).slice(2) + Date.now().toString(36);
    const passwordHash = await bcrypt.hash(rawPassword, 12);
    await tx.user.create({
      data: {
        email: data.email,
        passwordHash,
        name: data.ownerName,
        phone: data.ownerPhone,
        role: "OWNER",
        tenantId: tenant.id,
        branchId: branch.id,
        ...(data.googleId ? { googleId: data.googleId } : {}),
      },
    });

    // Seed the 4 default system roles + link the owner to the Owner role.
    const roleMap = await seedDefaultRoles(tx, tenant.id);
    await backfillUserRoles(tx, tenant.id, roleMap);

    // Create subscription (status TRIAL for the 14-day window; the effective tier
    // derives from tenant.trialTier + trialEndsAt in lib/billing.ts getTenantPlan).
    if (freePlan) {
      await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          planId: freePlan.id,
          status: "TRIAL",
          currentPeriodEnd: trialEndsAt,
        },
      });
    }

    // Seed default service groups + services for the branch
    const kiloanGroup = await tx.serviceGroup.create({
      data: { name: "Cuci Kiloan", branchId: branch.id },
    });
    const lainnyaGroup = await tx.serviceGroup.create({
      data: { name: "Lainnya", branchId: branch.id },
    });

    const defaultServices = [
      { name: "Cuci Kering", pricingType: "PER_KG" as const, basePrice: 7000, groupId: kiloanGroup.id },
      { name: "Cuci Setrika", pricingType: "PER_KG" as const, basePrice: 10000, groupId: kiloanGroup.id },
      { name: "Cuci Setrika Express", pricingType: "PER_KG" as const, basePrice: 15000, groupId: kiloanGroup.id },
      { name: "Cuci Sepatu", pricingType: "PER_ITEM" as const, basePrice: 25000, groupId: lainnyaGroup.id },
      { name: "Cuci Bedcover", pricingType: "PER_ITEM" as const, basePrice: 30000, groupId: lainnyaGroup.id },
    ];

    await tx.service.createMany({
      data: defaultServices.map((s) => ({
        ...s,
        branchId: branch.id,
      })),
    });

    // Link to referrer if a code was supplied (self-referral → REJECTED, no reward).
    await attachReferral(tx, tenant.id, data.referralCode, data.email, data.ownerPhone ?? "");

    return tenant;
  });

  return apiSuccess({
    slug: result.slug,
    message: "Bisnis berhasil dibuat",
  });
});
