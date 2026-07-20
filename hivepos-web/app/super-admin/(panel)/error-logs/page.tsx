"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/modules/shared";
import { formatDateTime } from "@/lib/format";
import { ResolveButton } from "./resolve-button";
import { Bug, Loader2 } from "lucide-react";
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

// Realigned to the 10 codes withErrorHandler can emit ( authoritative set from
// hivepos-api; frequency-sorted by current DB volume, zero-volume codes last).
const CODE_FILTERS = [
  { key: "ALL", label: "All" },
  { key: "BUSINESS_RULE_VIOLATION", label: "Business Rule" },
  { key: "CONFLICT", label: "Conflict" },
  { key: "RATE_LIMITED", label: "Rate Limited" },
  { key: "UNAUTHENTICATED", label: "Unauthorized" },
  { key: "FORBIDDEN", label: "Forbidden" },
  { key: "INTERNAL_ERROR", label: "Internal" },
  { key: "VALIDATION_ERROR", label: "Validation" },
  { key: "NOT_FOUND", label: "Not Found" },
  { key: "DATABASE_ERROR", label: "Database" },
  { key: "EXTERNAL_SERVICE_ERROR", label: "External" },
] as const;
const VALID_CODES = CODE_FILTERS.filter((c) => c.key !== "ALL").map((c) => c.key);
const RESOLVED_FILTERS = [
  { key: "ALL", label: "All" },
  { key: "OPEN", label: "Unresolved" },
  { key: "RESOLVED", label: "Resolved" },
] as const;

interface ErrorRow {
  id: string;
  createdAt: string;
  httpStatus?: number;
  code: string;
  method?: string;
  url: string;
  message?: string;
  tenantId?: string | null;
  resolved: boolean;
}
interface ErrorPageData {
  rows: ErrorRow[];
  page: number;
  hasNext: boolean;
}

function Loading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );
}

export default function ErrorLogsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <ErrorLogsInner />
    </Suspense>
  );
}

function ErrorLogsInner() {
  const sp = useSearchParams();
  const codeParam = sp.get("code") ?? undefined;
  const resolvedParam = sp.get("resolved") ?? undefined;
  const fromStr = sp.get("from");
  const toStr = sp.get("to");
  const pageParam = Number(sp.get("page") ?? "1");
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  const code = codeParam && (VALID_CODES as readonly string[]).includes(codeParam) ? codeParam : undefined;
  const resolvedParamKey = resolvedParam && resolvedParam !== "ALL" ? resolvedParam : "ALL";

  const [data, setData] = useState<ErrorPageData>({ rows: [], page: 1, hasNext: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), limit: "50" });
    if (code) qs.set("code", code);
    if (resolvedParam === "OPEN") qs.set("resolved", "false");
    else if (resolvedParam === "RESOLVED") qs.set("resolved", "true");
    if (fromStr) qs.set("from", fromStr);
    if (toStr) qs.set("to", toStr);
    apiFetch<ErrorPageData>(`/api/super-admin/error-logs?${qs.toString()}`)
      .then((r) => setData(r.data ?? { rows: [], page, hasNext: false }))
      .catch(() => setData({ rows: [], page, hasNext: false }))
      .finally(() => setLoading(false));
  }, [code, resolvedParam, fromStr, toStr, page]);

  function buildHref(field: string, key: string): string {
    const params = new URLSearchParams();
    if (code && field !== "code") params.set("code", code);
    if (resolvedParam && resolvedParam !== "ALL" && field !== "resolved") params.set("resolved", resolvedParam);
    if (fromStr) params.set("from", fromStr);
    if (toStr) params.set("to", toStr);
    if (page > 1) params.set("page", String(page));
    if (key !== "ALL") params.set(field, key);
    const qs = params.toString();
    return qs ? `/super-admin/error-logs?${qs}` : "/super-admin/error-logs";
  }
  function buildPageHref(p: number): string {
    const params = new URLSearchParams();
    if (code) params.set("code", code);
    if (resolvedParam && resolvedParam !== "ALL") params.set("resolved", resolvedParam);
    if (fromStr) params.set("from", fromStr);
    if (toStr) params.set("to", toStr);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/super-admin/error-logs?${qs}` : "/super-admin/error-logs";
  }

  if (loading) return <Loading />;

  const openCount = data.rows.filter((r) => !r.resolved).length;
  const resolvedCount = data.rows.length - openCount;

  const filterGroups: FilterGroup[] = [
    { field: "code", active: code ?? "ALL", options: CODE_FILTERS.map((c) => ({ key: c.key, label: c.label })) },
    { field: "resolved", active: resolvedParamKey, options: RESOLVED_FILTERS.map((r) => ({ key: r.key, label: r.label })) },
  ];

  const columns: Column<ErrorRow>[] = [
    { key: "time", header: "Time", render: (r) => <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</span> },
    { key: "status", header: "Status", render: (r) => <span className="inline-flex items-center rounded-md bg-destructive/10 px-1.5 py-0.5 text-[11px] font-bold text-destructive sa-tnum">{r.httpStatus ?? "—"}</span> },
    { key: "code", header: "Code", render: (r) => <span className="font-mono text-xs">{r.code}</span> },
    { key: "method", header: "Method", render: (r) => <span className="text-xs text-muted-foreground">{r.method ?? "—"}</span> },
    {
      key: "url", header: "URL", render: (r) => (
        <div className="max-w-xs">
          <div className="truncate font-mono text-xs" title={r.url}>{r.url}</div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground" title={r.message}>{r.message}</div>
        </div>
      ),
    },
    {
      key: "tenant", header: "Tenant", render: (r) =>
        r.tenantId ? <Link href={`/super-admin/tenants/${r.tenantId}`} className="text-xs hover:underline">view</Link> : <span className="text-muted-foreground/50">—</span>,
    },
    { key: "resolved", header: "State", render: (r) => <StatusPill tone={r.resolved ? "success" : "warning"} dot label={r.resolved ? "resolved" : "open"} /> },
  ];

  return (
    <div className="animate-fade-in-up">
      <PageHeader eyebrow="Operations" title="Error Logs" subtitle="5xx system errors captured by withErrorHandler. 4xx log to Pino only." icon={Bug} />

      <StatGrid cols={3} className="mb-6">
        <MetricTile icon={Bug} label="On This Page" value={data.rows.length} index={0} />
        <MetricTile icon={Bug} label="Unresolved" value={openCount} tone={openCount > 0 ? "danger" : "default"} index={1} />
        <MetricTile icon={Bug} label="Resolved" value={resolvedCount} tone="success" index={2} />
      </StatGrid>

      <div className="mb-4">
        <FilterBar groups={filterGroups} buildHref={buildHref} />
      </div>

      <DataTable
        columns={columns}
        rows={data.rows}
        getRowKey={(r) => r.id}
        rowActions={(r) => <ResolveButton errorLogId={r.id} resolved={r.resolved} />}
        emptyState={{ icon: Bug, title: "No errors match", hint: "Try clearing filters." }}
      />

      <Pagination page={data.page} hasNext={data.hasNext} buildHref={buildPageHref} />
    </div>
  );
}
