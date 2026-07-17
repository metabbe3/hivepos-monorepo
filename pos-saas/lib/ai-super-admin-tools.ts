import { prisma } from "@/lib/prisma";
import { formatCurrency, formatRelative } from "@/lib/format";
import { getPlatformBillingOverview } from "@/lib/billing-analytics";
import { wibDateBounds } from "@/lib/dates";

// Super-admin AI tools — platform-scoped, READ-ONLY.
// Mirror of the tenant ai-tools pattern, but the domain is the SaaS platform itself
// (tenants, subscriptions, billing, tickets, errors) — not any single tenant's data.
// No branchId scoping: the operator sees the whole platform. No mutation tools.

export const SUPER_ADMIN_TOOL_DISPLAY_NAMES: Record<string, string> = {
  get_platform_overview: "Platform Overview",
  get_mrr_summary: "Revenue / MRR",
  get_tenant_detail: "Tenant Detail",
  get_tenants_at_risk: "At-Risk Tenants",
  get_tickets_summary: "Support Tickets",
  get_error_logs: "Error Logs",
  query_database: "Database Query",
};

const MAX_TOOL_CHARS = 4000;

function truncateToolResult(jsonStr: string, maxChars: number = MAX_TOOL_CHARS): string {
  if (jsonStr.length <= maxChars) return jsonStr;
  try {
    const data = JSON.parse(jsonStr);
    for (const key of Object.keys(data)) {
      if (Array.isArray(data[key]) && data[key].length > 10) {
        const total = data[key].length;
        data[key] = data[key].slice(0, 10);
        data[key].push({ _note: `… and ${total - 10} more` });
      }
    }
    const truncated = JSON.stringify(data);
    if (truncated.length <= maxChars) return truncated;
    return truncated.slice(0, maxChars) + "\n... (data truncated, too long)";
  } catch {
    return jsonStr.slice(0, maxChars) + "\n... (data truncated)";
  }
}

/** Translate raw errors into user-safe messages — never leak Prisma/query internals. */
function sanitizeToolError(err: unknown): string {
  const msg = (err as Error).message || "";
  const lower = msg.toLowerCase();
  if (lower.includes("timeout") || lower.includes("timed out") || lower.includes("abort"))
    return "Permintaan terlalu lama, coba lagi";
  if (lower.includes("econnrefused") || lower.includes("fetch") || lower.includes("network"))
    return "Server sedang sibuk, coba lagi nanti";
  if (lower.includes("prisma") || lower.includes("query") || lower.includes("aggregate") || lower.includes("select"))
    return "Data tidak ditemukan";
  if (lower.includes("not found") || lower.includes("does not exist")) return "Data tidak ditemukan";
  return "Terjadi kesalahan saat mengambil data, coba lagi nanti";
}

function defaultRange(from?: string, to?: string) {
  // Local-calendar YYYY-MM-DD (not toISOString → no UTC shift), so the default
  // window matches the WIB business day the operator expects.
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const now = new Date();
  const today = fmt(now);
  const firstOfMonth = fmt(new Date(now.getFullYear(), now.getMonth(), 1));
  return { dateFrom: from || firstOfMonth, dateTo: to || today };
}

export async function executeSuperAdminTool(
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  try {
    switch (name) {
      case "get_platform_overview":
        return await getPlatformOverview();
      case "get_mrr_summary":
        return await getMrrSummary(args.from as string | undefined, args.to as string | undefined);
      case "get_tenant_detail":
        return await getTenantDetail((args.query as string) || "");
      case "get_tenants_at_risk":
        return await getTenantsAtRisk();
      case "get_tickets_summary":
        return await getTicketsSummary();
      case "get_error_logs":
        return await getErrorLogs();
      case "query_database":
        return await executeSuperAdminDatabaseQuery(
          args as unknown as Parameters<typeof executeSuperAdminDatabaseQuery>[0],
        );
      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (err) {
    return JSON.stringify({ error: sanitizeToolError(err) });
  }
}

/** Wrapper that applies truncation to all tool results (keeps prompt context bounded). */
export async function executeSuperAdminToolTruncated(
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  const result = await executeSuperAdminTool(name, args);
  return truncateToolResult(result);
}

// ─── Tools ──────────────────────────────────────────────────────────────────

async function getPlatformOverview() {
  const [
    totalTenants,
    activeTenants,
    suspendedTenants,
    pendingApprovals,
    trialTenants,
    totalUsers,
    totalOrders,
    billing,
  ] = await Promise.all([
    prisma.tenant.count(),
    prisma.tenant.count({ where: { isActive: true } }),
    prisma.tenant.count({ where: { isActive: false, approvedAt: { not: null } } }),
    prisma.tenant.count({ where: { approvedAt: null } }),
    prisma.subscription.count({ where: { status: "TRIAL" } }),
    prisma.user.count(),
    prisma.order.count(),
    getPlatformBillingOverview(),
  ]);

  const recentSignups = await prisma.tenant.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    select: {
      name: true,
      slug: true,
      ownerEmail: true,
      isActive: true,
      approvedAt: true,
      createdAt: true,
      subscription: { select: { status: true, plan: { select: { name: true, tier: true } } } },
    },
  });

  return JSON.stringify({
    tenants: { total: totalTenants, active: activeTenants, suspended: suspendedTenants, pendingApproval: pendingApprovals, onTrial: trialTenants },
    totalUsers,
    totalOrders,
    mrr: formatCurrency(billing.mrr),
    mrrRaw: billing.mrr,
    activePaidOutlets: billing.activePaidOutlets,
    paidTenantCount: billing.paidTenantCount,
    lifetimeGross: formatCurrency(billing.lifetimeGross),
    failedPayments30d: billing.failedCount30d,
    recentSignups: recentSignups.map((t) => ({
      nama: t.name,
      slug: t.slug,
      email: t.ownerEmail,
      status: t.approvedAt ? (t.isActive ? "Aktif" : "Suspended") : "Menunggu approval",
      plan: t.subscription?.plan?.name ?? (t.subscription ? t.subscription.plan?.name : "-"),
      bergabung: t.createdAt.toISOString().slice(0, 10),
    })),
  });
}

async function getMrrSummary(from?: string, to?: string) {
  const { dateFrom, dateTo } = defaultRange(from, to);
  const overview = await getPlatformBillingOverview();

  // WIB calendar-day bounds — date-only strings parse as UTC by JS spec; wibDateBounds
  // forces +07:00 so the window matches the operator's business day, not a 7h-shifted one.
  const bounds = wibDateBounds({ from: dateFrom, to: dateTo });

  const [paid, failed] = await Promise.all([
    prisma.saaSPayment.aggregate({
      where: { status: "PAID", createdAt: { gte: bounds.gte, lte: bounds.lte } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.saaSPayment.aggregate({
      where: { status: "FAILED", createdAt: { gte: bounds.gte, lte: bounds.lte } },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  return JSON.stringify({
    period: { from: dateFrom, to: dateTo },
    mrrBulanIni: formatCurrency(overview.mrr),
    mrrRaw: overview.mrr,
    outletBerbayarAktif: overview.activePaidOutlets,
    tenantBerbayar: overview.paidTenantCount,
    pendapatanSeumurHidup: formatCurrency(overview.lifetimeGross),
    gagalBayar30hari: overview.failedCount30d,
    periodeIni: {
      dari: dateFrom,
      sampai: dateTo,
      lunas: { jumlah: paid._count, total: formatCurrency(Number(paid._sum.amount ?? 0)) },
      gagal: { jumlah: failed._count, total: formatCurrency(Number(failed._sum.amount ?? 0)) },
    },
  });
}

async function getTenantDetail(query: string) {
  if (!query.trim()) {
    return JSON.stringify({ error: "Parameter query (nama/slug/email) diperlukan" });
  }
  const tenants = await prisma.tenant.findMany({
    where: {
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { slug: { contains: query, mode: "insensitive" } },
        { ownerEmail: { contains: query, mode: "insensitive" } },
      ],
    },
    take: 5,
    include: {
      subscription: { include: { plan: { select: { name: true, tier: true, priceMonthly: true } } } },
      branches: { select: { name: true, coverageEnd: true, isFreeTier: true, isActive: true } },
      _count: { select: { users: true } },
    },
  });

  if (tenants.length === 0) {
    return JSON.stringify({ hasil: "Tidak ditemukan tenant dengan kata kunci tersebut" });
  }

  // Order counts live on Branch, not Tenant — fetch per matched tenant.
  const withOrders = await Promise.all(
    tenants.map(async (t) => ({
      nama: t.name,
      slug: t.slug,
      email: t.ownerEmail,
      pemilik: t.ownerName ?? "-",
      telepon: t.ownerPhone ?? "-",
      status: t.approvedAt ? (t.isActive ? "Aktif" : "Suspended") : "Menunggu approval",
      trialBerakhir: t.trialEndsAt?.toISOString().slice(0, 10) ?? "-",
      langganan: {
        status: t.subscription?.status ?? "-",
        plan: t.subscription?.plan?.name ?? "-",
        tier: t.subscription?.plan?.tier ?? "-",
        hargaBulanan: t.subscription?.plan?.priceMonthly
          ? formatCurrency(Number(t.subscription.plan.priceMonthly))
          : "-",
        outletBerbayar: t.subscription?.paidOutletCount ?? 0,
      },
      jumlahStaff: t._count.users,
      jumlahPesanan: await prisma.order.count({ where: { branch: { tenantId: t.id } } }),
      outlet: t.branches.map((b) => ({
        nama: b.name,
        aktif: b.isActive,
        tipe: b.isFreeTier ? "Gratis" : "Berbayar",
        coverageBerakhir: b.coverageEnd?.toISOString().slice(0, 10) ?? "-",
      })),
    })),
  );

  return JSON.stringify(withOrders);
}

async function getTenantsAtRisk() {
  const now = new Date();
  const soon = new Date(now.getTime() + 14 * 86400000);
  const [trialsEnding, coverageEnding, suspended, pastDue] = await Promise.all([
    prisma.tenant.findMany({
      where: { trialEndsAt: { gte: now, lte: soon } },
      select: { name: true, slug: true, ownerEmail: true, trialEndsAt: true, trialTier: true },
      orderBy: { trialEndsAt: "asc" },
      take: 20,
    }),
    prisma.branch.findMany({
      where: { coverageEnd: { gte: now, lte: soon }, isFreeTier: false },
      select: { name: true, coverageEnd: true, tenant: { select: { name: true, slug: true } } },
      orderBy: { coverageEnd: "asc" },
      take: 20,
    }),
    prisma.tenant.findMany({
      where: { isActive: false, approvedAt: { not: null } },
      select: { name: true, slug: true, ownerEmail: true },
      take: 20,
    }),
    prisma.subscription.findMany({
      where: { status: "PAST_DUE" },
      select: {
        status: true,
        currentPeriodEnd: true,
        tenant: { select: { name: true, slug: true } },
        plan: { select: { name: true } },
      },
      take: 20,
    }),
  ]);

  return JSON.stringify({
    trialBerakhirDalam14Hari: trialsEnding.map((t) => ({
      nama: t.name,
      slug: t.slug,
      email: t.ownerEmail,
      berakhir: t.trialEndsAt?.toISOString().slice(0, 10) ?? "-",
      tier: t.trialTier ?? "-",
    })),
    coverageBerakhirDalam14Hari: coverageEnding.map((b) => ({
      tenant: b.tenant.name,
      outlet: b.name,
      berakhir: b.coverageEnd?.toISOString().slice(0, 10) ?? "-",
    })),
    suspended: suspended.map((t) => ({ nama: t.name, slug: t.slug, email: t.ownerEmail })),
    pembayaranGagalPastDue: pastDue.map((s) => ({
      tenant: s.tenant.name,
      plan: s.plan.name,
      periodeBerakhir: s.currentPeriodEnd?.toISOString().slice(0, 10) ?? "-",
    })),
    ringkasan: {
      trialBahaya: trialsEnding.length,
      coverageBahaya: coverageEnding.length,
      suspended: suspended.length,
      pastDue: pastDue.length,
    },
  });
}

const TICKET_PRIORITY_LABEL: Record<string, string> = {
  LOW: "Rendah",
  NORMAL: "Normal",
  HIGH: "Tinggi",
  URGENT: "Mendesak",
};

async function getTicketsSummary() {
  const openStatuses: ("OPEN" | "IN_PROGRESS")[] = ["OPEN", "IN_PROGRESS"];
  const [byPriority, byStatus, byCategory, oldest, csat, totalOpen] = await Promise.all([
    prisma.supportTicket.groupBy({ by: ["priority"], where: { status: { in: openStatuses } }, _count: true }),
    prisma.supportTicket.groupBy({ by: ["status"], _count: true }),
    prisma.supportTicket.groupBy({ by: ["category"], where: { status: { in: openStatuses } }, _count: true }),
    prisma.supportTicket.findFirst({
      where: { status: { in: openStatuses } },
      orderBy: { createdAt: "asc" },
      select: { subject: true, priority: true, submitterName: true, createdAt: true },
    }),
    prisma.supportTicket.aggregate({ where: { csatRating: { not: null } }, _avg: { csatRating: true }, _count: true }),
    prisma.supportTicket.count({ where: { status: { in: openStatuses } } }),
  ]);

  return JSON.stringify({
    tiketTerbuka: totalOpen,
    perPrioritas: byPriority.map((p) => ({ prioritas: TICKET_PRIORITY_LABEL[p.priority] ?? p.priority, jumlah: p._count })),
    perStatus: byStatus.map((s) => ({ status: s.status, jumlah: s._count })),
    perKategori: byCategory.map((c) => ({ kategori: c.category, jumlah: c._count })),
    terlamaBelumDitangani: oldest
      ? {
          subjek: oldest.subject,
          prioritas: TICKET_PRIORITY_LABEL[oldest.priority] ?? oldest.priority,
          pelapor: oldest.submitterName,
          usia: formatRelative(oldest.createdAt),
        }
      : null,
    rataRataCSAT: csat._avg.csatRating ? Number(csat._avg.csatRating).toFixed(2) : null,
    jumlahRatingCSAT: csat._count,
  });
}

async function getErrorLogs() {
  const where = { resolved: false, httpStatus: { gte: 500 } };
  const [recent, byTenant, total] = await Promise.all([
    prisma.errorLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { httpStatus: true, code: true, message: true, url: true, method: true, tenantId: true, createdAt: true },
    }),
    prisma.errorLog.groupBy({
      by: ["tenantId"],
      where,
      _count: true,
      orderBy: { _count: { tenantId: "desc" } },
      take: 10,
    }),
    prisma.errorLog.count({ where }),
  ]);

  return JSON.stringify({
    totalError5xxBelumDiselesaikan: total,
    terbaru: recent.map((e) => ({
      status: e.httpStatus,
      kode: e.code,
      metode: e.method,
      url: e.url,
      pesan: e.message,
      tenantId: e.tenantId ?? "-",
      saat: formatRelative(e.createdAt),
    })),
    perTenant: byTenant.map((t) => ({ tenantId: t.tenantId ?? "(platform)", jumlah: t._count })),
  });
}

// ─── Read-only ad-hoc query (platform models) ──────────────────────────────

const ALLOWED_MODELS = new Set([
  "tenant",
  "subscription",
  "plan",
  "saaSPayment",
  "supportTicket",
  "errorLog",
  "auditLog",
  "user",
  "branch",
  "promoCode",
]);

const ALLOWED_OPERATIONS = new Set(["findMany", "aggregate", "groupBy", "count"]);

// Sensitive fields never returned to the model.
const EXCLUDED_FIELDS: Record<string, string[]> = {
  user: ["passwordHash", "sessionVersion", "googleId"],
  tenant: ["settings"],
  saaSPayment: ["midtransSnapToken"],
};

const MAX_TAKE = 100;

interface SafeQuery {
  model: string;
  operation: "findMany" | "aggregate" | "groupBy" | "count";
  where?: Record<string, unknown>;
  select?: Record<string, boolean>;
  orderBy?: Record<string, string>;
  take?: number;
  skip?: number;
  _sum?: string[];
  _count?: boolean;
  _avg?: string[];
  by?: string[];
}

function convertDecimals(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "object" && obj !== null && "toFixed" in obj && typeof (obj as { toFixed?: unknown }).toFixed === "function") {
    return Number(obj);
  }
  if (Array.isArray(obj)) return obj.map(convertDecimals);
  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = convertDecimals(value);
    }
    return result;
  }
  return obj;
}

/**
 * Defense-in-depth: strip sensitive field names from query results.
 * The select-based exclusion only fires when the model provides a `select` — but a
 * `findMany` without a select, or a `groupBy by:["passwordHash"]`, would otherwise
 * return credential columns (passwordHash/sessionVersion/googleId) raw into the
 * model's context. This removes them at the result boundary regardless.
 */
export function stripExcludedFields(value: unknown, fields: string[]): unknown {
  if (Array.isArray(value)) return value.map((item) => stripRecord(item, fields));
  return stripRecord(value, fields);
}
function stripRecord(rec: unknown, fields: string[]): unknown {
  if (!rec || typeof rec !== "object") return rec;
  // Decimal-likes are leaves (converted later by convertDecimals).
  if ("toFixed" in rec && typeof (rec as { toFixed?: unknown }).toFixed === "function") return rec;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rec as Record<string, unknown>)) {
    if (fields.includes(k)) continue;
    out[k] = v;
  }
  return out;
}

export async function executeSuperAdminDatabaseQuery(query: SafeQuery): Promise<string> {
  const modelName = query.model?.toLowerCase();
  if (!modelName || !ALLOWED_MODELS.has(modelName)) {
    return JSON.stringify({ error: `Model "${query.model}" is not allowed. Allowed: ${[...ALLOWED_MODELS].join(", ")}` });
  }
  // ponytail: superAdminUser deliberately excluded — never expose operator account credentials to the model.
  if (!ALLOWED_OPERATIONS.has(query.operation)) {
    return JSON.stringify({ error: `Operation "${query.operation}" is not allowed. Allowed: ${[...ALLOWED_OPERATIONS].join(", ")}` });
  }

  const where = { ...(query.where || {}) };
  const take = query.take ? Math.min(query.take, MAX_TAKE) : MAX_TAKE;
  const excluded = EXCLUDED_FIELDS[modelName] || [];
  const select = query.select
    ? { ...query.select, ...Object.fromEntries(excluded.map((f) => [f, false])) }
    : undefined;

  try {
    const delegate = (prisma as unknown as Record<string, Record<string, (...args: unknown[]) => Promise<unknown>>>)[modelName];
    if (!delegate || typeof delegate[query.operation] !== "function") {
      return JSON.stringify({ error: `Model "${modelName}" does not support operation "${query.operation}"` });
    }

    let args: Record<string, unknown> = {};
    switch (query.operation) {
      case "findMany":
        args = { where, take };
        if (select) args.select = select;
        if (query.orderBy) args.orderBy = query.orderBy;
        if (query.skip) args.skip = query.skip;
        break;
      case "count":
        args = { where };
        break;
      case "aggregate": {
        const agg: Record<string, unknown> = {};
        if (query._sum && query._sum.length > 0) agg._sum = Object.fromEntries(query._sum.map((f) => [f, true]));
        if (query._count) agg._count = true;
        if (query._avg && query._avg.length > 0) agg._avg = Object.fromEntries(query._avg.map((f) => [f, true]));
        args = { where, ...agg };
        break;
      }
      case "groupBy": {
        if (!query.by || query.by.length === 0) {
          return JSON.stringify({ error: "groupBy requires 'by' field with at least one column name" });
        }
        args = { by: query.by, where, take };
        if (query._sum && query._sum.length > 0) args._sum = Object.fromEntries(query._sum.map((f) => [f, true]));
        if (query._count) args._count = true;
        if (query._avg && query._avg.length > 0) args._avg = Object.fromEntries(query._avg.map((f) => [f, true]));
        if (query.orderBy) args.orderBy = query.orderBy;
        break;
      }
    }

    const result = await delegate[query.operation](args);
    const stripped = excluded.length ? stripExcludedFields(result, excluded) : result;
    return JSON.stringify(convertDecimals(stripped));
  } catch (err) {
    return JSON.stringify({ error: sanitizeToolError(err) });
  }
}
