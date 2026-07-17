import { withErrorHandler, apiSuccess } from "@/modules/shared";
import { requireWithBranchOrThrow } from "@/lib/permissions/check";
import { getReferralStats } from "@/lib/referrals";

// GET — the owner's own referral code + share link + reward stats.
export const GET = withErrorHandler(async (req) => {
  const ctx = await requireWithBranchOrThrow("billing", "read");
  const stats = await getReferralStats(ctx.tenantId);
  // ponytail: use the configured public origin (NEXTAUTH_URL), NOT req.url.origin —
  // behind Docker the request origin is the container's internal hostname
  // (e.g. http://2e792953e16e:3000), which would produce an unshareable link.
  const origin =
    process.env.NEXTAUTH_URL || process.env.AUTH_URL || new URL(req.url).origin;
  return apiSuccess({
    ...stats,
    shareUrl: `${origin}/register?ref=${stats.code}`,
  });
});
