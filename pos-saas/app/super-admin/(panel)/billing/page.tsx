import { CreditCard, AlertCircle, DollarSign, Users } from "lucide-react";
import { requireSuperAdminPanelSession } from "@/lib/super-admin/permissions";
import { getPlatformBillingOverview, getPaymentLedger } from "@/lib/billing-analytics";
import { PRICE_PER_OUTLET } from "@/lib/billing";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  PageHeader,
  StatGrid,
  MetricTile,
  FilterBar,
  type FilterGroup,
  DataTable,
  type Column,
  StatusPill,
  type PillTone,
} from "@/components/super-admin";
import { RefundButton } from "./refund-button";
import { CsvExportButton } from "@/components/shared/csv-export-button";
import { SAAS_PAYMENT_STATUS_LABELS } from "@/lib/super-admin/labels";

const STATUS_TONE: Record<string, PillTone> = {
  PENDING: "warning",
  PAID: "success",
  FAILED: "danger",
  REFUNDED: "muted",
};

export default async function SuperAdminBillingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSuperAdminPanelSession();

  const sp = await searchParams;
  const statusParam = typeof sp.status === "string" ? sp.status : undefined;
  const VALID = ["PENDING", "PAID", "FAILED", "REFUNDED"] as const;
  const status =
    statusParam && statusParam !== "ALL" &&
    (VALID as readonly string[]).includes(statusParam)
      ? (statusParam as (typeof VALID)[number])
      : undefined;

  const [overview, ledger] = await Promise.all([
    getPlatformBillingOverview(),
    getPaymentLedger({ status, page: 1, pageSize: 50 }),
  ]);

  function buildHref(field: string, key: string): string {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (k === "status" || v === undefined) continue;
      if (typeof v === "string") params.set(k, v);
    }
    if (key !== "ALL") params.set("status", key);
    const qs = params.toString();
    return qs ? `/super-admin/billing?${qs}` : "/super-admin/billing";
  }

  const filterGroup: FilterGroup = {
    field: "status",
    active: status ?? "ALL",
    options: [
      { key: "ALL", label: "All" },
      { key: "PENDING", label: "Pending" },
      { key: "PAID", label: "Paid" },
      { key: "FAILED", label: "Failed" },
      { key: "REFUNDED", label: "Refunded" },
    ],
  };

  type Row = (typeof ledger.rows)[number];

  const columns: Column<Row>[] = [
    {
      key: "tenant",
      header: "Tenant",
      render: (r) => <span className="font-medium">{r.tenantName}</span>,
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      render: (r) => <span className="sa-tnum font-semibold">{formatCurrency(r.amount)}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <StatusPill tone={STATUS_TONE[r.status] ?? "muted"} label={SAAS_PAYMENT_STATUS_LABELS[r.status] ?? r.status} dot />
      ),
    },
    {
      key: "kind",
      header: "Kind",
      render: (r) => (
        <span className="text-muted-foreground">
          {r.kind ?? "—"}
          {r.monthsPurchased > 0 && r.outletCount > 0 && (
            <span className="ml-1 text-xs">({r.monthsPurchased}mo · {r.outletCount} outlet)</span>
          )}
        </span>
      ),
    },
    {
      key: "coverage",
      header: "Coverage Until",
      render: (r) => <span className="text-muted-foreground">{r.coverageEnd ? formatDate(r.coverageEnd) : "—"}</span>,
    },
    {
      key: "created",
      header: "Created",
      align: "right",
      render: (r) => <span className="text-muted-foreground">{formatDate(r.createdAt)}</span>,
    },
  ];

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        eyebrow="Customers"
        title="Billing"
        subtitle="Platform revenue, payment ledger, and refunds."
        icon={CreditCard}
      />

      <StatGrid cols={4} className="mb-6">
        <MetricTile
          icon={CreditCard}
          label="MRR"
          value={formatCurrency(overview.mrr)}
          sub={`${overview.activePaidOutlets} outlets × ${formatCurrency(PRICE_PER_OUTLET)}`}
          tone="primary"
          span={2}
          index={0}
        />
        <MetricTile icon={Users} label="Paid Tenants" value={overview.paidTenantCount} tone="success" index={1} />
        <MetricTile
          icon={DollarSign}
          label="Lifetime Gross"
          value={formatCurrency(overview.lifetimeGross)}
          index={2}
        />
      </StatGrid>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <FilterBar groups={[filterGroup]} buildHref={buildHref} />
        <CsvExportButton url={`/api/super-admin/billing/payments/export${status ? `?status=${status}` : ""}`} />
      </div>

      {overview.failedCount30d > 0 && (
        <div className="mb-4">
          <MetricTile
            icon={AlertCircle}
            label="Failed Payments (30d)"
            value={overview.failedCount30d}
            tone="danger"
            href="/super-admin/billing?status=FAILED"
            index={0}
          />
        </div>
      )}

      <DataTable
        columns={columns}
        rows={ledger.rows}
        getRowKey={(r) => r.id}
        getRowHref={(r) => `/super-admin/tenants/${r.tenantId}`}
        rowActions={(r) =>
          r.status === "PAID" ? (
            <RefundButton paymentId={r.id} tenantName={r.tenantName} amount={formatCurrency(r.amount)} />
          ) : null
        }
        emptyState={{
          icon: CreditCard,
          title: status ? "No matching payments" : "No payments yet",
          hint: status ? "Try a different filter." : "Payments will appear here once tenants subscribe.",
        }}
      />
    </div>
  );
}
