import { withErrorHandler, apiSuccess, ForbiddenError } from "@/modules/shared";
import { purgeExpiredPhotos } from "@/lib/photo-cleanup";

// POST /api/photo-cleanup — daily sweep that deletes order photos past their
// 7-day TTL. Authorized by a shared CRON_SECRET bearer (the lazy purge on upload
// only covers active tenants; this catches idle ones).
//
// Wire from the host crontab (the middleware's bearer→cookie rewrite keeps the
// Authorization header intact, so this reads it directly):
//   0 3 * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" \
//     http://localhost:3007/api/photo-cleanup
export const POST = withErrorHandler(async (req) => {
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  // ponytail: fail-closed — never run an open purge. If no secret is configured,
  // the endpoint 403s (the lazy upload-time purge still keeps things bounded).
  if (!secret || auth !== `Bearer ${secret}`) {
    throw new ForbiddenError("Unauthorized");
  }

  const purged = await purgeExpiredPhotos();
  return apiSuccess({ purged, at: new Date().toISOString() });
});
