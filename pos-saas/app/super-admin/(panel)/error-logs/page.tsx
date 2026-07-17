import Link from "next/link";
import { requireSuperAdminPanelSession } from "@/lib/super-admin/permissions";
import { getErrorLogs } from "@/lib/error-logs";
import { parseDateRange } from "@/lib/dates";
import { formatDateTime } from "@/lib/format";
import { ResolveButton } from "./resolve-button";
import { Bug } from "lucide-react";
import {
  PageHeader,
  StatGrid,
  MetricTile,
  FilterBar,
  type FilterGroup,
  DataTable,
  type Column,
  StatusPill,
  Pagination,
} from "@/components/super-admin";

const CODE_FILTERS = [
  { key: "ALL", label: "All" },
  { key: "INTERNAL_ERROR", label: "Internal" },
  { key: "DATABASE_ERROR", label: "Database" },
  { key: "EXTERNAL_SERVICE_ERROR", label: "External" },
] as const;

const VALID_CODES = CODE_FILTERS.filter((c) => c.key !== "ALL").map((c) => c.key);

const RESOLVED_FILTERS = [
  { key: "ALL", label: "All" },
  { key: "OPEN", label: "Unresolved" },
  { key: "RESOLVED", label: "Resolved" },
] as const;

export default async function ErrorLogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSuperAdminPanelSession();
  const sp = await searchParams;

  const codeParam = typeof sp.code === "string" ? sp.code : undefined;
  const resolvedParam = typeof sp.resolved === "string" ? sp.resolved : undefined;
  const fromStr = typeof sp.from === "string" ? sp.from : null;
  const toStr = typeof sp.to === "string" ? sp.to : null;
  const pageParam = typeof sp.page === "string" ? Number(sp.page) : 1;
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  const code =
    codeParam && (VALID_CODES as readonly string[]).includes(codeParam)
      ? codeParam
      : undefined;
  const resolved =
    resolvedParam === "OPEN"
      ? false
      : resolvedParam === "RESOLVED"
        ? true
        : undefined;
  const range = parseDateRange({ from: fromStr, to: toStr });

  const logs = await getErrorLogs({
    ...(code && { code }),
    ...(resolved !== undefined && { resolved }),
    ...(range.from && { from: range.from }),
    ...(range.to && { to: range.to }),
    page,
    pageSize: 50,
  });

  const openCount = logs.rows.filter((r) => !r.resolved).length;
  const resolvedCount = logs.rows.length - openCount;

  function buildHref(field: string, key: string): string {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (k === field || k === "page" || v === undefined) continue;
      if (typeof v === "string") params.set(k, v);
    }
    if (key !== "ALL") params.set(field, key);
    const qs = params.toString();
    return qs ? `/super-admin/error-logs?${qs}` : "/super-admin/error-logs";
  }

  function buildPageHref(p: number): string {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (k === "page" || v === undefined) continue;
      if (typeof v === "string") params.set(k, v);
    }
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/super-admin/error-logs?${qs}` : "/super-admin/error-logs";
  }

  const filterGroups: FilterGroup[] = [
    { field: "code", active: code ?? "ALL", options: CODE_FILTERS.map((c) => ({ key: c.key, label: c.label })) },
    { field: "resolved", active: resolvedParam && resolvedParam !== "ALL" ? resolvedParam : "ALL", options: RESOLVED_FILTERS.map((r) => ({ key: r.key, label: r.label })) },
  ];

  type Row = (typeof logs.rows)[number];

  const columns: Column<Row>[] = [
    {
      key: "time",
      header: "Time",
      render: (r) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <span className="inline-flex items-center rounded-md bg-destructive/10 px-1.5 py-0.5 text-[11px] font-bold text-destructive sa-tnum">
          {r.httpStatus}
        </span>
      ),
    },
    {
      key: "code",
      header: "Code",
      render: (r) => <span className="font-mono text-xs">{r.code}</span>,
    },
    {
      key: "method",
      header: "Method",
      render: (r) => <span className="text-xs text-muted-foreground">{r.method}</span>,
    },
    {
      key: "url",
      header: "URL",
      render: (r) => (
        <div className="max-w-xs">
          <div className="truncate font-mono text-xs" title={r.url}>{r.url}</div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground" title={r.message}>{r.message}</div>
        </div>
      ),
    },
    {
      key: "tenant",
      header: "Tenant",
      render: (r) =>
        r.tenantId ? (
          <Link href={`/super-admin/tenants/${r.tenantId}`} className="text-xs hover:underline">
            view
          </Link>
        ) : (
          <span className="text-muted-foreground/50">—</span>
        ),
    },
    {
      key: "resolved",
      header: "State",
      render: (r) => (
        <StatusPill
          tone={r.resolved ? "success" : "warning"}
          dot
          label={r.resolved ? "resolved" : "open"}
        />
      ),
    },
  ];

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        eyebrow="Operations"
        title="Error Logs"
        subtitle="5xx system errors captured by withErrorHandler. 4xx log to Pino only."
        icon={Bug}
      />

      <StatGrid cols={3} className="mb-6">
        <MetricTile icon={Bug} label="On This Page" value={logs.rows.length} index={0} />
        <MetricTile icon={Bug} label="Unresolved" value={openCount} tone={openCount > 0 ? "danger" : "default"} index={1} />
        <MetricTile icon={Bug} label="Resolved" value={resolvedCount} tone="success" index={2} />
      </StatGrid>

      <div className="mb-4">
        <FilterBar groups={filterGroups} buildHref={buildHref} />
      </div>

      {/* Date filter — native form, no client JS */}
      <form method="GET" className="mb-4 flex flex-wrap items-end gap-3">
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
        {code && <input type="hidden" name="code" value={code} />}
        {resolvedParam && resolvedParam !== "ALL" && (
          <input type="hidden" name="resolved" value={resolvedParam} />
        )}
        <button
          type="submit"
          className="rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Apply
        </button>
        {(fromStr || toStr) && (
          <Link
            href={(() => {
              const p = new URLSearchParams();
              if (code) p.set("code", code);
              if (resolvedParam && resolvedParam !== "ALL") p.set("resolved", resolvedParam);
              const qs = p.toString();
              return qs ? `/super-admin/error-logs?${qs}` : "/super-admin/error-logs";
            })()}
            className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            Clear
          </Link>
        )}
      </form>

      <DataTable
        columns={columns}
        rows={logs.rows}
        getRowKey={(r) => r.id}
        rowActions={(r) => <ResolveButton errorLogId={r.id} resolved={r.resolved} />}
        emptyState={{
          icon: Bug,
          title: "No errors match",
          hint: "Try clearing filters.",
        }}
      />

      <Pagination page={logs.page} hasNext={logs.hasNext} buildHref={buildPageHref} />
    </div>
  );
}
