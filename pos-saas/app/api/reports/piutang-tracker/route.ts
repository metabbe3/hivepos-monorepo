import { withErrorHandler, apiSuccess } from "@/modules/shared";
import { UNPAID_PAYMENT_STATUSES } from "@/lib/constants";
import { requireWithBranchOrThrow } from "@/lib/permissions/check";
import { prisma } from "@/lib/prisma";
import { wibDateBounds } from "@/lib/dates";

// Piutang Tracker — AR aging + monthly timeline + per-order payment history.
//
// ponytail: was fetching ALL orders + their nested payments + customer on every
// call (and again for outstanding) — an unbounded fetch that scales with total
// order count × payments-per-order. Split into:
//   - summaryOrders: ALL orders but ONLY aggregate fields (createdAt, amounts,
//     paymentStatus) — no payments/customer. Drives the monthly timeline.
//   - detailOrders: the per-order detail table, now bounded by the client's
//     from/to date picker (default last 12 months) + a 500-row cap, WITH
//     payments + customer. The client date picker is respected (was ignored).
//   - outstandingOrders: unpaid only, light fields — drives aging buckets.
// Aging + monthly timeline still cover all history; only the detail list is
// bounded.

const DAY_MS = 86_400_000;
const DETAIL_PAGE_SIZE = 500;

export const GET = withErrorHandler(async (req) => {
  const ctx = await requireWithBranchOrThrow("reports", "read");
  const { branchIds } = ctx;

  // Detail-table date window: respect client from/to, else default last 12
  // months so the per-order list is bounded (monthly summary + aging still span
  // all history via the lighter fetches below).
  const { searchParams } = new URL(req.url);
  const fromStr = searchParams.get("from");
  const toStr = searchParams.get("to");
  let detailGte: Date | undefined;
  let detailLte: Date | undefined;
  if (fromStr || toStr) {
    const b = wibDateBounds({ from: fromStr || undefined, to: toStr || undefined });
    detailGte = b.gte ?? undefined;
    detailLte = b.lte ?? undefined;
  } else {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    detailGte = d;
  }

  const [summaryOrders, outstandingOrders, detailOrders] = await Promise.all([
    // Monthly timeline — ALL orders, light fields only (no payments/customer).
    prisma.order.findMany({
      where: { branchId: { in: branchIds } },
      select: {
        createdAt: true,
        totalAmount: true,
        paidAmount: true,
        paymentStatus: true,
      },
    }),
    // Aging snapshot — unpaid orders only, light fields.
    prisma.order.findMany({
      where: {
        branchId: { in: branchIds },
        paymentStatus: { in: UNPAID_PAYMENT_STATUSES },
      },
      select: { totalAmount: true, paidAmount: true, receivedAt: true, createdAt: true },
    }),
    // Per-order detail (bounded by date window + page cap) WITH payment history.
    prisma.order.findMany({
      where: {
        branchId: { in: branchIds },
        createdAt: { ...(detailGte ? { gte: detailGte } : {}), ...(detailLte ? { lte: detailLte } : {}) },
      },
      include: {
        payments: { orderBy: { paidAt: "asc" } },
        customer: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: DETAIL_PAGE_SIZE,
    }),
  ]);

  const now = new Date();

  // ── Monthly summary (by order creation month) ──
  const monthMap = new Map<string, { newOrders: number; newPiutang: number; paidSoFar: number; fullyPaidCount: number }>();
  for (const o of summaryOrders) {
    const monthKey = o.createdAt.toISOString().slice(0, 7);
    const total = Number(o.totalAmount);
    const paid = Number(o.paidAmount);
    const entry = monthMap.get(monthKey) ?? { newOrders: 0, newPiutang: 0, paidSoFar: 0, fullyPaidCount: 0 };
    entry.newOrders++;
    entry.newPiutang += total;
    entry.paidSoFar += paid;
    if (o.paymentStatus === "PAID") entry.fullyPaidCount++;
    monthMap.set(monthKey, entry);
  }
  const monthlySummary = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, d]) => ({ month, ...d, stillOutstanding: d.newPiutang - d.paidSoFar }));

  // ── Aging buckets (current snapshot) ──
  const buckets: Record<string, { amount: number; count: number }> = {
    "0-30": { amount: 0, count: 0 },
    "31-60": { amount: 0, count: 0 },
    "61-90": { amount: 0, count: 0 },
    "90+": { amount: 0, count: 0 },
  };
  let totalOutstanding = 0;
  for (const o of outstandingOrders) {
    const refDate = o.receivedAt ?? o.createdAt;
    const ageDays = Math.floor((now.getTime() - refDate.getTime()) / DAY_MS);
    const outstanding = Number(o.totalAmount) - Number(o.paidAmount);
    totalOutstanding += outstanding;
    const bucket = ageDays <= 30 ? "0-30" : ageDays <= 60 ? "31-60" : ageDays <= 90 ? "61-90" : "90+";
    buckets[bucket].amount += outstanding;
    buckets[bucket].count++;
  }

  // ── Per-order detail (with payment history) — bounded by the date window ──
  const orders = detailOrders.map((o) => {
    const refDate = o.receivedAt ?? o.createdAt;
    const ageDays = Math.floor((now.getTime() - refDate.getTime()) / DAY_MS);
    const outstanding = Number(o.totalAmount) - Number(o.paidAmount);
    return {
      id: o.id,
      orderNumber: o.orderNumber,
      customer: o.customer?.name ?? "-",
      createdAt: o.createdAt.toISOString().slice(0, 10),
      totalAmount: Number(o.totalAmount),
      paidAmount: Number(o.paidAmount),
      outstanding,
      ageDays,
      bucket: ageDays <= 30 ? "0-30" : ageDays <= 60 ? "31-60" : ageDays <= 90 ? "61-90" : "90+",
      status: o.paymentStatus,
      payments: o.payments.map((p) => ({
        amount: Number(p.amount),
        paidAt: (p.paidAt ?? p.createdAt).toISOString().slice(0, 10),
        method: p.paymentMethod,
      })),
    };
  });

  return apiSuccess({
    monthlySummary,
    agingBuckets: buckets,
    totalOutstanding,
    outstandingOrderCount: outstandingOrders.length,
    orders,
  });
});
