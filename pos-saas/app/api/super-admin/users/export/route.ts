import { assertSuperAdminOrThrow } from "@/lib/super-admin/permissions";
import { auditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { toCSV, csvResponse, csvHandler } from "@/lib/csv";

// GET — CSV export of platform users. SUPER_ADMIN or SUPPORT.
export const GET = csvHandler(async (req: Request) => {
  const { session } = await assertSuperAdminOrThrow();
  const actor = { id: session.user.id!, email: session.user.email! };

  const url = new URL(req.url);
  const sp = url.searchParams;

  const q = sp.get("q")?.trim() || undefined;
  const tenantId = sp.get("tenantId") || undefined;
  const isActiveParam = sp.get("isActive");
  const isActive =
    isActiveParam === "true" ? true : isActiveParam === "false" ? false : undefined;

  const where = {
    ...(tenantId && { tenantId }),
    ...(isActive !== undefined && { isActive }),
    ...(q && {
      OR: [
        { email: { contains: q, mode: "insensitive" as const } },
        { name: { contains: q, mode: "insensitive" as const } },
      ],
    }),
  };

  const rows = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 10_000,
    include: {
      tenant: { select: { name: true, slug: true } },
      branch: { select: { name: true } },
    },
  });

  const csv = toCSV(
    ["User ID", "Email", "Name", "Phone", "Role", "Active", "Tenant", "Tenant Slug", "Branch", "Created At"],
    rows.map((u) => [
      u.id,
      u.email,
      u.name,
      u.phone ?? "",
      u.role,
      u.isActive ? "yes" : "no",
      u.tenant.name,
      u.tenant.slug,
      u.branch?.name ?? "",
      u.createdAt.toISOString(),
    ]),
  );

  await auditLog(prisma, {
    actor,
    action: "users.export",
    target: { type: "User", id: "export" },
    diff: { rowCount: rows.length, filters: { q, tenantId, isActive } },
    req,
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return csvResponse(`users-${stamp}.csv`, csv);
});
