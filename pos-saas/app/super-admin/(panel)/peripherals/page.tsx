import Link from "next/link";
import { requireSuperAdminPanelSession } from "@/lib/super-admin/permissions";
import {
  getTelemetryStats,
  getRecentTelemetry,
  getPrinterStats,
  getPrinterMethodStats,
  getSlowQueries,
  getWebVitals,
  TELEMETRY_KINDS,
} from "@/lib/telemetry";
import { formatDateTime } from "@/lib/format";
import { Printer, Activity, Gauge, Cable, CheckCircle2, AlertOctagon, Timer, Database, Zap } from "lucide-react";
import {
  PageHeader,
  StatGrid,
  MetricTile,
  DataTable,
  type Column,
  EmptyState,
} from "@/components/super-admin";

// kind → icon map for the stat tiles. Add icons here as kinds come online.
const KIND_META: Record<string, { icon: typeof Printer; label: string; status: string }> = {
  print: { icon: Printer, label: "Print Events", status: "Live" },
  "query.slow": { icon: Gauge, label: "Slow Queries", status: "Live" },
  web_vitals: { icon: Activity, label: "Web Vitals", status: "Live" },
};

const METHOD_LABEL: Record<string, string> = {
  network: "Network (WiFi/LAN)",
  bluetooth: "Bluetooth",
  usb: "USB (Serial)",
  browser: "Browser Print",
};

// Core Web Vitals thresholds — used for color coding.
// ponytail: hardcoded thresholds from Chrome UX Report conventions.
const LCP_GOOD = 2500;
const LCP_POOR = 4000;
const INP_GOOD = 200;
const INP_POOR = 500;
const CLS_GOOD = 0.1;
const CLS_POOR = 0.25;

function lcpTone(ms: number): "default" | "success" | "warning" | "danger" {
  if (ms === 0) return "default";
  return ms <= LCP_GOOD ? "success" : ms <= LCP_POOR ? "warning" : "danger";
}

export default async function PeripheralsPage() {
  await requireSuperAdminPanelSession();

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // last 24h
  const [stats, recent, printer, methods, slowQueries, webVitals] = await Promise.all([
    getTelemetryStats({ since }),
    getRecentTelemetry({ limit: 50 }),
    getPrinterStats({ since }),
    getPrinterMethodStats({ since }),
    getSlowQueries({ since, limit: 10 }),
    getWebVitals({ since, limit: 10 }),
  ]);

  type Row = Awaited<typeof recent>[number];

  const columns: Column<Row>[] = [
    {
      key: "time",
      header: "Time",
      render: (r) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {formatDateTime(r.createdAt)}
        </span>
      ),
    },
    {
      key: "kind",
      header: "Kind",
      render: (r) => (
        <span className="inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-primary">
          {r.kind}
        </span>
      ),
    },
    {
      key: "tenant",
      header: "Tenant",
      render: (r) =>
        r.tenantId ? (
          <Link
            href={`/super-admin/tenants/${r.tenantId}`}
            className="text-xs hover:underline"
          >
            view
          </Link>
        ) : (
          <span className="text-muted-foreground/50">—</span>
        ),
    },
    {
      key: "payload",
      header: "Payload",
      render: (r) => (
        <div className="max-w-md">
          <pre className="truncate font-mono text-[11px] text-muted-foreground" title={JSON.stringify(r.payload)}>
            {JSON.stringify(r.payload)}
          </pre>
        </div>
      ),
    },
  ];

  type MethodRow = (typeof methods)[number];
  const methodColumns: Column<MethodRow>[] = [
    {
      key: "method",
      header: "Method",
      render: (r) => (
        <span className="text-sm font-medium">
          {METHOD_LABEL[r.method] ?? r.method}
        </span>
      ),
    },
    {
      key: "total",
      header: "Prints",
      render: (r) => <span className="text-sm">{r.total}</span>,
    },
    {
      key: "ok",
      header: "Success",
      render: (r) => <span className="text-sm text-emerald-600 dark:text-emerald-400">{r.ok}</span>,
    },
    {
      key: "failed",
      header: "Failed",
      render: (r) => (
        <span className={r.failed > 0 ? "text-sm text-red-600 dark:text-red-400 font-medium" : "text-sm text-muted-foreground"}>
          {r.failed}
        </span>
      ),
    },
    {
      key: "p50",
      header: "p50",
      render: (r) => <span className="text-sm text-muted-foreground">{r.p50Ms}ms</span>,
    },
    {
      key: "p95",
      header: "p95",
      render: (r) => (
        <span className={r.p95Ms > 2000 ? "text-sm text-amber-600 dark:text-amber-400 font-medium" : "text-sm"}>
          {r.p95Ms}ms
        </span>
      ),
    },
  ];

  type SlowRow = (typeof slowQueries)[number];
  const slowColumns: Column<SlowRow>[] = [
    {
      key: "sql",
      header: "Query",
      render: (r) => (
        <pre className="max-w-lg truncate font-mono text-[11px] text-muted-foreground" title={r.sql}>
          {r.sql}
        </pre>
      ),
    },
    {
      key: "samples",
      header: "Samples",
      render: (r) => <span className="text-sm text-muted-foreground">{r.samples}</span>,
    },
    {
      key: "p95",
      header: "p95",
      render: (r) => (
        <span className={r.p95Ms > 1000 ? "text-sm text-red-600 dark:text-red-400 font-medium" : r.p95Ms > 500 ? "text-sm text-amber-600 dark:text-amber-400 font-medium" : "text-sm"}>
          {r.p95Ms}ms
        </span>
      ),
    },
    {
      key: "max",
      header: "Max",
      render: (r) => <span className="text-sm text-muted-foreground">{r.maxMs}ms</span>,
    },
  ];

  type VitalsRow = (typeof webVitals)[number];
  const vitalsColumns: Column<VitalsRow>[] = [
    {
      key: "route",
      header: "Route",
      render: (r) => (
        <span className="font-mono text-xs text-foreground">{r.route}</span>
      ),
    },
    {
      key: "samples",
      header: "n",
      render: (r) => <span className="text-sm text-muted-foreground">{r.samples}</span>,
    },
    {
      key: "lcp",
      header: "LCP",
      render: (r) => {
        const tone = lcpTone(r.lcpP75);
        const cls =
          tone === "success"
            ? "text-sm text-emerald-600 dark:text-emerald-400"
            : tone === "warning"
              ? "text-sm text-amber-600 dark:text-amber-400 font-medium"
              : "text-sm text-red-600 dark:text-red-400 font-medium";
        return <span className={cls}>{r.lcpP75 === 0 ? "—" : `${r.lcpP75}ms`}</span>;
      },
    },
    {
      key: "inp",
      header: "INP",
      render: (r) => {
        const tone =
          r.inpP75 === 0 ? "default" : r.inpP75 <= INP_GOOD ? "success" : r.inpP75 <= INP_POOR ? "warning" : "danger";
        const cls =
          tone === "success"
            ? "text-sm text-emerald-600 dark:text-emerald-400"
            : tone === "warning"
              ? "text-sm text-amber-600 dark:text-amber-400 font-medium"
              : tone === "danger"
                ? "text-sm text-red-600 dark:text-red-400 font-medium"
                : "text-sm text-muted-foreground";
        return <span className={cls}>{r.inpP75 === 0 ? "—" : `${r.inpP75}ms`}</span>;
      },
    },
    {
      key: "cls",
      header: "CLS",
      render: (r) => {
        const tone =
          r.clsP75 === 0 ? "default" : r.clsP75 <= CLS_GOOD ? "success" : r.clsP75 <= CLS_POOR ? "warning" : "danger";
        const cls =
          tone === "success"
            ? "text-sm text-emerald-600 dark:text-emerald-400"
            : tone === "warning"
              ? "text-sm text-amber-600 dark:text-amber-400 font-medium"
              : tone === "danger"
                ? "text-sm text-red-600 dark:text-red-400 font-medium"
                : "text-sm text-muted-foreground";
        return <span className={cls}>{r.clsP75 === 0 ? "—" : r.clsP75.toFixed(3)}</span>;
      },
    },
    {
      key: "fcp",
      header: "FCP",
      render: (r) => <span className="text-sm text-muted-foreground">{r.fcpP75 === 0 ? "—" : `${r.fcpP75}ms`}</span>,
    },
  ];

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        eyebrow="Monitor"
        title="Peripherals"
        subtitle="Hardware + performance telemetry from installed clients. Streams come online as phases ship."
        icon={Cable}
      />

      <StatGrid cols={4} className="mb-6">
        <MetricTile
          icon={Cable}
          label="Events (24h)"
          value={stats.total}
          index={0}
        />
        {TELEMETRY_KINDS.map((kind, i) => {
          const meta = KIND_META[kind];
          const count = stats.byKind[kind] ?? 0;
          return (
            <MetricTile
              key={kind}
              icon={meta.icon}
              label={meta.label}
              value={count}
              sub={`${meta.status} • ${kind}`}
              index={i + 1}
            />
          );
        })}
      </StatGrid>

      {/* Phase 4: Printer telemetry */}
      <div className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Printers (24h)
        </h2>
        <StatGrid cols={4} className="mb-4">
          <MetricTile
            icon={Printer}
            label="Total Prints"
            value={printer.total}
            index={0}
          />
          <MetricTile
            icon={CheckCircle2}
            label="Success Rate"
            value={printer.total === 0 ? "—" : `${(printer.successRate * 100).toFixed(1)}%`}
            sub={`${printer.ok} ok`}
            tone={printer.total === 0 ? "default" : printer.successRate >= 0.95 ? "success" : printer.successRate >= 0.8 ? "warning" : "danger"}
            index={1}
          />
          <MetricTile
            icon={Timer}
            label="p95 Latency"
            value={printer.total === 0 ? "—" : `${printer.p95Ms}ms`}
            sub={printer.total === 0 ? undefined : `p50 ${printer.p50Ms}ms`}
            tone={printer.total === 0 ? "default" : printer.p95Ms > 3000 ? "warning" : "success"}
            index={2}
          />
          <MetricTile
            icon={AlertOctagon}
            label="Hard Failures"
            value={printer.failed}
            sub={printer.total === 0 ? undefined : `${((printer.failed / Math.max(printer.total, 1)) * 100).toFixed(1)}% of prints`}
            tone={printer.failed === 0 ? "default" : "danger"}
            index={3}
          />
        </StatGrid>

        <DataTable
          columns={methodColumns}
          rows={methods}
          getRowKey={(r) => r.method}
          emptyState={{
            icon: Printer,
            title: "No print events yet",
            hint: "Print a receipt from any order to populate printer telemetry.",
          }}
        />
      </div>

      {/* Phase 5: Slow queries */}
      <div className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <Database className="h-3.5 w-3.5" />
          Slow Queries (24h, &gt;{process.env.SLOW_QUERY_MS ?? "200"}ms threshold)
        </h2>
        <DataTable
          columns={slowColumns}
          rows={slowQueries}
          getRowKey={(r) => r.sql}
          emptyState={{
            icon: Database,
            title: "No slow queries recorded",
            hint: "Queries exceeding the threshold will appear here. Empty is good.",
          }}
        />
      </div>

      {/* Phase 5: Web Vitals */}
      <div className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <Zap className="h-3.5 w-3.5" />
          Web Vitals (24h, p75 per route)
        </h2>
        <DataTable
          columns={vitalsColumns}
          rows={webVitals}
          getRowKey={(r) => r.route}
          emptyState={{
            icon: Zap,
            title: "No vitals samples yet",
            hint: "Vitals are reported on tab hide / page unload in production. Visit any dashboard page to populate.",
          }}
        />
      </div>

      {/* Recent events stream */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Recent Events
        </h2>
        <DataTable
          columns={columns}
          rows={recent}
          getRowKey={(r) => r.id}
          emptyState={{
            icon: Cable,
            title: "No telemetry yet",
            hint: "Events will appear here as phases 5 (queries + web vitals) ship.",
          }}
        />
      </div>
    </div>
  );
}
