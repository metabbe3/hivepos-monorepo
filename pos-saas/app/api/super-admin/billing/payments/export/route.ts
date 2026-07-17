import { assertSuperAdminOrThrow } from "@/lib/super-admin/permissions";
import { auditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { toCSV, csvResponse, csvHandler } from "@/lib/csv";
import { ValidationError } from "@/modules/shared";

const VALID_STATUSES = ["PENDING", "PAID", "FAILED", "REFUNDED"] as const;

// GET — CSV export of SaaS payments. SUPER_ADMIN or SUPPORT.
// ponytail: returns text/csv, not the JSON envelope — csvHandler gives us auth/error parity.
export const GET = csvHandler(async (req: Request) => {
  const { session } = await assertSuperAdminOrThrow();
  const actor = { id: session.user.id!, email: session.user.email! };

  const url = new URL(req.url);
  const sp = url.searchParams;

  const status = sp.get("status");
  if (status && !(VALID_STATUSES as readonly string[]).includes(status)) {
    throw new ValidationError(`Invalid status: ${status}`);
  }

  const from = sp.get("from");
  const to = sp.get("to");
  const tenantId = sp.get("tenantId") || undefined;

  const where = {
    ...(status && { status: status as (typeof VALID_STATUSES)[number] }),
    ...(tenantId && { tenantId }),
    ...((from || to) && {
      createdAt: {
        ...(from && { gte: new Date(from) }),
        ...(to && { lte: new Date(to) }),
      },
    }),
  };

  // ponytail: cap at 10k rows. If a real billing period exceeds this, paginate or stream.
  const rows = await prisma.saaSPayment.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 10_000,
    include: { tenant: { select: { name: true, slug: true } } },
  });

  const csv = toCSV(
    ["Payment ID", "Tenant", "Tenant Slug", "Amount", "Status", "Kind", "Months", "Outlets", "Coverage End", "Created At", "Paid At"],
    rows.map((p) => [
      p.id,
      p.tenant.name,
      p.tenant.slug,
      Number(p.amount),
      p.status,
      p.kind,
      p.monthsPurchased ?? "",
      p.outletCount ?? "",
      p.coverageEnd?.toISOString() ?? "",
      p.createdAt.toISOString(),
      p.paidAt?.toISOString() ?? "",
    ]),
  );

  await auditLog(prisma, {
    actor,
    action: "billing.payments.export",
    target: { type: "SaaSPayment", id: "export" },
    diff: { rowCount: rows.length, filters: { status, from, to, tenantId } },
    req,
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return csvResponse(`payments-${stamp}.csv`, csv);
});
