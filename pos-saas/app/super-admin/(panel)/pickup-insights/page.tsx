import Link from "next/link";
import { requireSuperAdminPanelSession } from "@/lib/super-admin/permissions";
import { getPickupInsights } from "@/lib/pickup-insights";
import { parseDateRange } from "@/lib/dates";
import { Truck, AlertOctagon, Percent } from "lucide-react";
import {
  PageHeader,
  StatGrid,
  MetricTile,
  DetailSection,
} from "@/components/super-admin";

export default async function PickupInsightsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSuperAdminPanelSession();
  const sp = await searchParams;
  const fromStr = typeof sp.from === "string" ? sp.from : null;
  const toStr = typeof sp.to === "string" ? sp.to : null;
  const range = parseDateRange({ from: fromStr, to: toStr });

  const insights = await getPickupInsights({
    ...(range.from && { from: range.from }),
    ...(range.to && { to: range.to }),
  });

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        eyebrow="Monitor"
        title="Pickup Insights"
        subtitle="Why staff reject pickup requests, and where rates are highest."
        icon={Truck}
      />

      <StatGrid cols={3} className="mb-6">
        <MetricTile
          icon={AlertOctagon}
          label="Total Rejected"
          value={<span className="sa-tnum">{insights.totalRejected}</span>}
          tone={insights.totalRejected > 0 ? "danger" : "default"}
          index={0}
        />
        <MetricTile
          icon={Percent}
          label="Rejection Rate"
          value={
            <span className="sa-tnum">
              {(insights.rejectionRate * 100).toFixed(1)}%
            </span>
          }
          tone={insights.rejectionRate > 0.1 ? "warning" : "default"}
          index={1}
        />
        <MetricTile
          icon={Truck}
          label="Total Requests"
          value={<span className="sa-tnum">{insights.totalAll}</span>}
          index={2}
        />
      </StatGrid>

      {/* Date filter */}
      <form method="GET" className="mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">From</label>
          <input
            type="date"
            name="from"
            defaultValue={fromStr ?? ""}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">To</label>
          <input
            type="date"
            name="to"
            defaultValue={toStr ?? ""}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Apply
        </button>
        {(fromStr || toStr) && (
          <Link
            href="/super-admin/pickup-insights"
            className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            Clear
          </Link>
        )}
      </form>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <DetailSection title="Top Rejection Reasons" icon={AlertOctagon}>
          <BarTable
            rows={insights.topReasons.map((r) => ({
              label: r.reason,
              count: r.count,
              pct: r.pct,
            }))}
          />
        </DetailSection>

        <DetailSection title="Top Tenants by Rejection Rate" icon={Truck}>
          <BarTable
            rows={insights.topTenantsByRate.map((r) => ({
              label: r.tenantName,
              count: r.rejected,
              pct: r.rate,
              href: `/super-admin/tenants/${r.tenantId}`,
              sub: `${r.rejected} of ${r.total}`,
            }))}
          />
        </DetailSection>

        <DetailSection title="Top Branches by Rejection Rate" icon={Truck}>
          <BarTable
            rows={insights.topBranchesByRate.map((r) => ({
              label: r.branchName,
              count: r.rejected,
              pct: r.rate,
              href: r.tenantId ? `/super-admin/tenants/${r.tenantId}` : undefined,
              sub: `${r.tenantName} · ${r.rejected} of ${r.total}`,
            }))}
          />
        </DetailSection>
      </div>
    </div>
  );
}

function BarTable({
  rows,
}: {
  rows: {
    label: string;
    count: number;
    pct: number;
    href?: string;
    sub?: string;
  }[];
}) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No data in range.</p>;
  }
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map((r, i) => {
          const labelEl = r.href ? (
            <Link href={r.href} className="font-medium hover:underline">
              {r.label}
            </Link>
          ) : (
            <span className="font-medium">{r.label}</span>
          );
          return (
            <tr key={`${r.label}-${i}`} className="border-b border-border/40 last:border-0">
              <td className="py-2 pr-2 align-top">
                {labelEl}
                {r.sub && <div className="text-[11px] text-muted-foreground">{r.sub}</div>}
              </td>
              <td className="py-2 pr-2 text-right align-top tabular-nums">{r.count}</td>
              <td className="py-2 w-28 align-top">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-destructive/80 to-destructive/60"
                      style={{ width: `${Math.min(100, Math.round(r.pct * 100))}%` }}
                    />
                  </div>
                  <span className="w-9 text-right text-[11px] tabular-nums text-muted-foreground">
                    {(r.pct * 100).toFixed(0)}%
                  </span>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
