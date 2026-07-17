import { withErrorHandler, apiSuccess } from "@/modules/shared";
import { assertSuperAdminOrThrow } from "@/lib/super-admin/permissions";
import { getPlatformUsers } from "@/lib/user-admin";

export const GET = withErrorHandler(async (req: Request) => {
  await assertSuperAdminOrThrow();
  const url = new URL(req.url);
  const sp = url.searchParams;

  const q = sp.get("q") || undefined;
  const tenantId = sp.get("tenantId") || undefined;
  const isActiveParam = sp.get("isActive");
  const isActive =
    isActiveParam === "true" ? true : isActiveParam === "false" ? false : undefined;
  const page = Math.max(1, Number(sp.get("page") ?? "1"));
  const pageSize = Math.min(Math.max(1, Number(sp.get("pageSize") ?? "50")), 100);

  const result = await getPlatformUsers({ q, tenantId, isActive, page, pageSize });
  return apiSuccess(result);
});
