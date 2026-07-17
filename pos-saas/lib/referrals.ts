import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { extendOutletCoverage } from "@/lib/billing";
import { auditLog } from "@/lib/audit";
import { resolveFlag } from "@/lib/feature-flags";
import { normalizePhone } from "@/lib/whatsapp";
import { logger } from "@/modules/shared";

/** Max rewarded referrals per referrer — anti-abuse blast-radius cap. */
export const REFERRAL_CAP = 12;
/** Free outlet-months granted to each side on a successful referral. */
export const REWARD_MONTHS = 1;

const SYSTEM_ACTOR = { id: "system", email: "system@hivepos.id" };

/** Prisma transaction client (matches the lib/billing.ts convention). */
type Tx = Parameters<Parameters<typeof prisma["$transaction"]>[0]>[0];

/** Random 8-char base36 referral code, e.g. "K8X2PQ9A". */
export function generateReferralCode(): string {
  return randomBytes(8)
    .readBigUInt64LE()
    .toString(36)
    .slice(0, 8)
    .toUpperCase()
    .padStart(8, "0");
}

/** Generate a code verified unique against existing tenants (pre-create). */
export async function generateUniqueReferralCode(): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const code = generateReferralCode();
    const clash = await prisma.tenant.findUnique({
      where: { referralCode: code },
      select: { id: true },
    });
    if (!clash) return code;
  }
  return (generateReferralCode() + generateReferralCode()).slice(0, 12);
}

/**
 * Link a newly-created tenant to their referrer — call inside the register tx.
 * Anti-abuse: invalid code → ignored; referrer's email OR phone matches the new
 * owner → recorded as REJECTED (self-referral block) so it can never reward.
 */
export async function attachReferral(
  tx: Tx,
  newTenantId: string,
  code: string | undefined,
  newEmail: string,
  newPhone: string,
): Promise<void> {
  if (!code) return;
  const referrer = await tx.tenant.findUnique({
    where: { referralCode: code },
    select: { id: true, ownerEmail: true, ownerPhone: true },
  });
  if (!referrer || referrer.id === newTenantId) return;

  const sameEmail =
    !!referrer.ownerEmail &&
    referrer.ownerEmail.toLowerCase() === newEmail.toLowerCase();
  const samePhone =
    !!referrer.ownerPhone &&
    !!newPhone &&
    normalizePhone(referrer.ownerPhone) === normalizePhone(newPhone);

  if (sameEmail || samePhone) {
    // Self-referral attempt — record for the ledger, never reward.
    await tx.referral.create({
      data: {
        referrerId: referrer.id,
        referredId: newTenantId,
        status: "REJECTED",
        reason: "self_referral",
      },
    });
    return;
  }

  await tx.referral.create({
    data: { referrerId: referrer.id, referredId: newTenantId, status: "PENDING" },
  });
}

/**
 * Reward trigger — call after a SaaSPayment is marked PAID (webhook).
 * Grants REWARD_MONTHS to BOTH referrer + referred, but ONLY on the referred
 * tenant's FIRST paid payment, under the referrer cap. Best-effort: never
 * throws (the payment is already confirmed; the reward is a bonus that can be
 * granted manually from the super-admin ledger if this path fails).
 */
export async function maybeRewardReferral(tenantId: string): Promise<void> {
  try {
    if (!(await resolveFlag("referralProgram", tenantId))) return; // platform kill-switch

    await prisma.$transaction(async (tx) => {
      const referral = await tx.referral.findUnique({
        where: { referredId: tenantId },
        select: { id: true, referrerId: true, status: true },
      });
      if (!referral || referral.status !== "PENDING") return;

      // Gate: first real paid payment only (paidCount is 1 right after markPaid).
      const paidCount = await tx.saaSPayment.count({
        where: { tenantId, status: "PAID" },
      });
      if (paidCount !== 1) return;

      // Cap: bound the referrer's total rewarded referrals.
      const rewarded = await tx.referral.count({
        where: { referrerId: referral.referrerId, status: "REWARDED" },
      });
      if (rewarded >= REFERRAL_CAP) {
        await tx.referral.update({
          where: { id: referral.id },
          data: { status: "EXPIRED", reason: "over_cap" },
        });
        await auditLog(tx, {
          actor: SYSTEM_ACTOR,
          action: "referral.expired",
          target: { type: "Referral", id: referral.id },
          diff: { reason: "over_cap", referrerId: referral.referrerId },
        });
        return;
      }

      // Reward both sides: 1 outlet-month on each tenant's first active outlet.
      const referrerBranch = await tx.branch.findFirst({
        where: { tenantId: referral.referrerId, isActive: true },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      const referredBranch = await tx.branch.findFirst({
        where: { tenantId, isActive: true },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      if (referrerBranch) {
        await extendOutletCoverage(tx, referral.referrerId, [referrerBranch.id], REWARD_MONTHS);
      }
      if (referredBranch) {
        await extendOutletCoverage(tx, tenantId, [referredBranch.id], REWARD_MONTHS);
      }

      await tx.referral.update({
        where: { id: referral.id },
        data: { status: "REWARDED", rewardedAt: new Date() },
      });
      await auditLog(tx, {
        actor: SYSTEM_ACTOR,
        action: "referral.reward",
        target: { type: "Referral", id: referral.id },
        diff: {
          rewardMonths: REWARD_MONTHS,
          referrerId: referral.referrerId,
          referredId: tenantId,
        },
      });
    });
  } catch (err) {
    // ponytail: best-effort — never break payment confirmation. The reward can
    // be granted manually from /super-admin/referrals if this path fails.
    logger.warn(
      { tenantId, cause: (err as Error).message },
      "Referral reward failed (best-effort, payment already confirmed)",
    );
  }
}

/** Return a tenant's referralCode, generating + persisting one if missing. */
export async function ensureReferralCode(tenantId: string): Promise<string> {
  const t = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { referralCode: true },
  });
  if (t?.referralCode) return t.referralCode;
  const code = await generateUniqueReferralCode();
  try {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { referralCode: code },
    });
  } catch {
    // rare concurrent collision — the @unique guard rejected; code is still valid
  }
  return code;
}

/** Owner-facing: their code + how many referrals rewarded/pending. */
export async function getReferralStats(tenantId: string): Promise<{
  code: string;
  rewarded: number;
  pending: number;
  cap: number;
  rewardMonths: number;
}> {
  const [code, rewarded, pending] = await Promise.all([
    ensureReferralCode(tenantId),
    prisma.referral.count({ where: { referrerId: tenantId, status: "REWARDED" } }),
    prisma.referral.count({ where: { referrerId: tenantId, status: "PENDING" } }),
  ]);
  return { code, rewarded, pending, cap: REFERRAL_CAP, rewardMonths: REWARD_MONTHS };
}
