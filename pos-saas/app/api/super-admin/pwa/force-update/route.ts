import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { withErrorHandler, apiSuccess } from "@/modules/shared";
import { assertSuperAdminOrThrow } from "@/lib/super-admin/permissions";
import { auditLog } from "@/lib/audit";

// Force-update is platform-wide: rotate the PWA nonce so every installed
// client detects the change on its next poll, nukes its caches, unregisters
// its SW, and reloads. Used for shipping hotfixes / breaking SW changes
// without waiting for users to discover the install is stale.
export const POST = withErrorHandler(async (req: Request) => {
  const { session } = await assertSuperAdminOrThrow("SUPER_ADMIN");
  const actor = { id: session.user.id!, email: session.user.email! };

  const newNonce = randomUUID();

  await prisma.$transaction(async (tx) => {
    await tx.systemSetting.upsert({
      where: { key: "pwa.forceUpdateNonce" },
      update: { value: newNonce },
      create: { key: "pwa.forceUpdateNonce", value: newNonce },
    });
    await auditLog(tx, {
      actor,
      action: "pwa.force-update",
      target: { type: "SystemSetting", id: "pwa.forceUpdateNonce" },
      diff: { nonce: newNonce },
      req,
    });
  });

  return apiSuccess({ ok: true, nonce: newNonce });
});

