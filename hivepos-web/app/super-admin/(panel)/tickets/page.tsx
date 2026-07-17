"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/modules/shared";
import { formatDateTime } from "@/lib/format";
import {
  TICKET_STATUS_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_CATEGORY_LABELS,
} from "@/lib/super-admin/labels";
import { TicketRowActions } from "./ticket-row-actions";
import { MessageSquare, AlertTriangle, CheckCircle2, Star, Loader2 } from "lucide-react";
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
  type PillTone,
} from "@/components/super-admin";

const STATUS_FILTERS = [
  { key: "ALL", label: "All" },
  { key: "OPEN", label: "Open" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "RESOLVED", label: "Resolved" },
  { key: "CLOSED", label: "Closed" },
] as const;

const PRIORITY_FILTERS = [
  { key: "ALL", label: "All" },
  { key: "LOW", label: "Low" },
  { key: "NORMAL", label: "Normal" },
  { key: "HIGH", label: "High" },
  { key: "URGENT", label: "Urgent" },
] as const;

const CATEGORY_FILTERS = [
  { key: "ALL", label: "All" },
  { key: "BILLING", label: "Billing" },
  { key: "TECHNICAL", label: "Technical" },
  { key: "ACCOUNT", label: "Account" },
  { key: "OTHER", label: "Other" },
] as const;

const STATUS_TONE: Record<string, PillTone> = {
  OPEN: "warning",
  IN_PROGRESS: "primary",
  RESOLVED: "success",
  CLOSED: "muted",
};
const PRIORITY_TONE: Record<string, PillTone> = {
  LOW: "muted",
  NORMAL: "muted",
  HIGH: "warning",
  URGENT: "danger",
};

interface TicketRow {
  id: string;
  subject: string;
  description?: string;
  commentCount?: number;
  submitterName?: string;
  submitterEmail?: string;
  tenantId?: string;
  tenantName?: string;
  category: string;
  priority: string;
  status: string;
  csatRating?: number | null;
  createdAt: string;
}
interface TicketsPage {
  rows: TicketRow[];
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

export default function TicketsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <TicketsInner />
    </Suspense>
  );
}

function TicketsInner() {
  const sp = useSearchParams();
  const status = sp.get("status") ?? undefined;
  const priority = sp.get("priority") ?? undefined;
  const category = sp.get("category") ?? undefined;
  const pageParam = Number(sp.get("page") ?? "1");
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  const [data, setData] = useState<TicketsPage>({ rows: [], page: 1, hasNext: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), limit: "50" });
    if (status) qs.set("status", status);
    if (priority) qs.set("priority", priority);
    if (category) qs.set("category", category);
    apiFetch<TicketsPage>(`/api/super-admin/tickets?${qs.toString()}`)
      .then((r) => setData(r.data ?? { rows: [], page, hasNext: false }))
      .catch(() => setData({ rows: [], page, hasNext: false }))
      .finally(() => setLoading(false));
  }, [status, priority, category, page]);

  function buildHref(field: string, key: string): string {
    const params = new URLSearchParams();
    if (status && field !== "status") params.set("status", status);
    if (priority && field !== "priority") params.set("priority", priority);
    if (category && field !== "category") params.set("category", category);
    if (page > 1) params.set("page", String(page));
    if (key !== "ALL") params.set(field, key);
    const qs = params.toString();
    return qs ? `/super-admin/tickets?${qs}` : "/super-admin/tickets";
  }
  function buildPageHref(p: number): string {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (priority) params.set("priority", priority);
    if (category) params.set("category", category);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/super-admin/tickets?${qs}` : "/super-admin/tickets";
  }

  if (loading) return <Loading />;

  const openCount = data.rows.filter((t) => t.status === "OPEN" || t.status === "IN_PROGRESS").length;
  const urgentCount = data.rows.filter((t) => t.priority === "URGENT").length;
  const rated = data.rows.filter((t) => t.csatRating != null);
  const avgCsat = rated.length
    ? (rated.reduce((s, t) => s + (t.csatRating ?? 0), 0) / rated.length).toFixed(1)
    : "—";

  const filterGroups: FilterGroup[] = [
    { field: "status", active: status ?? "ALL", options: STATUS_FILTERS.map((s) => ({ key: s.key, label: s.label })) },
    { field: "priority", active: priority ?? "ALL", options: PRIORITY_FILTERS.map((p) => ({ key: p.key, label: p.label })) },
    { field: "category", active: category ?? "ALL", options: CATEGORY_FILTERS.map((c) => ({ key: c.key, label: c.label })) },
  ];

  const columns: Column<TicketRow>[] = [
    {
      key: "subject",
      header: "Subject",
      render: (t) => (
        <div className="max-w-md">
          <div className="font-medium text-foreground">{t.subject}</div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground" title={t.description}>
            {t.description}
          </div>
          {!!t.commentCount && t.commentCount > 0 && (
            <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground/80">
              <MessageSquare className="h-3 w-3" />
              {t.commentCount}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "submitter",
      header: "Submitter",
      render: (t) => (
        <div>
          <div className="font-medium">{t.submitterName ?? "—"}</div>
          <div className="text-xs text-muted-foreground">{t.submitterEmail ?? ""}</div>
        </div>
      ),
    },
    {
      key: "tenant",
      header: "Tenant",
      render: (t) =>
        t.tenantId ? (
          <span className="font-medium">{t.tenantName ?? "—"}</span>
        ) : (
          <span className="text-muted-foreground/50">—</span>
        ),
    },
    {
      key: "category",
      header: "Category",
      render: (t) => (
        <span className="text-muted-foreground">{TICKET_CATEGORY_LABELS[t.category] ?? t.category}</span>
      ),
    },
    {
      key: "priority",
      header: "Priority",
      render: (t) => (
        <StatusPill tone={PRIORITY_TONE[t.priority] ?? "muted"} label={TICKET_PRIORITY_LABELS[t.priority] ?? t.priority} />
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (t) => (
        <StatusPill dot tone={STATUS_TONE[t.status] ?? "muted"} label={TICKET_STATUS_LABELS[t.status] ?? t.status} />
      ),
    },
    {
      key: "csat",
      header: "CSAT",
      render: (t) =>
        t.csatRating != null ? (
          <span className="inline-flex items-center gap-0.5 text-amber-500" title={`${t.csatRating}/5`}>
            <Star className="h-3.5 w-3.5 fill-current" />
            <span className="sa-tnum text-xs">{t.csatRating}</span>
          </span>
        ) : ["RESOLVED", "CLOSED"].includes(t.status) ? (
          <span className="text-xs text-muted-foreground/60">Pending</span>
        ) : (
          <span className="text-xs text-muted-foreground/30">—</span>
        ),
    },
    {
      key: "created",
      header: "Created",
      align: "right",
      render: (t) => <span className="text-xs text-muted-foreground">{formatDateTime(t.createdAt)}</span>,
    },
  ];

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        eyebrow="Operations"
        title="Support Tickets"
        subtitle="Customer-submitted complaints and questions from /support."
        icon={MessageSquare}
      />

      <StatGrid cols={4} className="mb-6">
        <MetricTile icon={MessageSquare} label="Open / In Progress" value={openCount} tone={openCount > 0 ? "warning" : "default"} index={0} />
        <MetricTile icon={AlertTriangle} label="Urgent" value={urgentCount} tone={urgentCount > 0 ? "danger" : "default"} index={1} />
        <MetricTile icon={CheckCircle2} label="On This Page" value={data.rows.length} index={2} />
        <MetricTile icon={Star} label="Avg CSAT" value={avgCsat} tone="primary" index={3} />
      </StatGrid>

      <div className="mb-4">
        <FilterBar groups={filterGroups} buildHref={buildHref} />
      </div>

      <DataTable
        columns={columns}
        rows={data.rows}
        getRowKey={(t) => t.id}
        getRowHref={(t) => `/super-admin/tickets/${t.id}`}
        rowActions={(t) => (
          <TicketRowActions ticketId={t.id} currentStatus={t.status as any} currentPriority={t.priority as any} />
        )}
        emptyState={{ icon: MessageSquare, title: "No tickets match", hint: "Try clearing filters." }}
      />

      <Pagination page={data.page} hasNext={data.hasNext} buildHref={buildPageHref} />
    </div>
  );
}
