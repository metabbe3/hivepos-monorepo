import { requireSuperAdminPanelSession } from "@/lib/super-admin/permissions";
import { getTickets, type TicketStatus, type TicketPriority, type TicketCategory } from "@/lib/tickets";
import { formatDateTime } from "@/lib/format";
import {
  TICKET_STATUS_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_CATEGORY_LABELS,
} from "@/lib/super-admin/labels";
import { TicketRowActions } from "./ticket-row-actions";
import { MessageSquare, AlertTriangle, CheckCircle2, Star } from "lucide-react";
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

const VALID_STATUSES = STATUS_FILTERS.filter((s) => s.key !== "ALL").map((s) => s.key);
const VALID_PRIORITIES = PRIORITY_FILTERS.filter((p) => p.key !== "ALL").map((p) => p.key);
const VALID_CATEGORIES = CATEGORY_FILTERS.filter((c) => c.key !== "ALL").map((c) => c.key);

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSuperAdminPanelSession();
  const sp = await searchParams;

  const statusParam = typeof sp.status === "string" ? sp.status : undefined;
  const priorityParam = typeof sp.priority === "string" ? sp.priority : undefined;
  const categoryParam = typeof sp.category === "string" ? sp.category : undefined;
  const pageParam = typeof sp.page === "string" ? Number(sp.page) : 1;
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  const status =
    statusParam && VALID_STATUSES.includes(statusParam as TicketStatus)
      ? (statusParam as TicketStatus)
      : undefined;
  const priority =
    priorityParam && VALID_PRIORITIES.includes(priorityParam as TicketPriority)
      ? (priorityParam as TicketPriority)
      : undefined;
  const category =
    categoryParam && VALID_CATEGORIES.includes(categoryParam as TicketCategory)
      ? (categoryParam as TicketCategory)
      : undefined;

  const tickets = await getTickets({ status, priority, category, page, pageSize: 50 });

  const openCount = tickets.rows.filter((t) => t.status === "OPEN" || t.status === "IN_PROGRESS").length;
  const urgentCount = tickets.rows.filter((t) => t.priority === "URGENT").length;
  const ratedCount = tickets.rows.filter((t) => t.csatRating !== null).length;
  const avgCsat = ratedCount
    ? (tickets.rows.reduce((s, t) => s + (t.csatRating ?? 0), 0) / ratedCount).toFixed(1)
    : "—";

  function buildHref(field: string, key: string): string {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (k === field || k === "page" || v === undefined) continue;
      if (typeof v === "string") params.set(k, v);
    }
    if (key !== "ALL") params.set(field, key);
    const qs = params.toString();
    return qs ? `/super-admin/tickets?${qs}` : "/super-admin/tickets";
  }

  function buildPageHref(p: number): string {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (k === "page" || v === undefined) continue;
      if (typeof v === "string") params.set(k, v);
    }
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/super-admin/tickets?${qs}` : "/super-admin/tickets";
  }

  const filterGroups: FilterGroup[] = [
    { field: "status", active: status ?? "ALL", options: STATUS_FILTERS.map((s) => ({ key: s.key, label: s.label })) },
    { field: "priority", active: priority ?? "ALL", options: PRIORITY_FILTERS.map((p) => ({ key: p.key, label: p.label })) },
    { field: "category", active: category ?? "ALL", options: CATEGORY_FILTERS.map((c) => ({ key: c.key, label: c.label })) },
  ];

  type Row = (typeof tickets.rows)[number];

  const columns: Column<Row>[] = [
    {
      key: "subject",
      header: "Subject",
      render: (t) => (
        <div className="max-w-md">
          <div className="font-medium text-foreground">{t.subject}</div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground" title={t.description}>
            {t.description}
          </div>
          {t.commentCount > 0 && (
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
          <div className="font-medium">{t.submitterName}</div>
          <div className="text-xs text-muted-foreground">{t.submitterEmail}</div>
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
        t.csatRating !== null ? (
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
        <MetricTile icon={CheckCircle2} label="On This Page" value={tickets.rows.length} index={2} />
        <MetricTile icon={Star} label="Avg CSAT" value={avgCsat} tone="primary" index={3} />
      </StatGrid>

      <div className="mb-4">
        <FilterBar groups={filterGroups} buildHref={buildHref} />
      </div>

      <DataTable
        columns={columns}
        rows={tickets.rows}
        getRowKey={(t) => t.id}
        getRowHref={(t) => `/super-admin/tickets/${t.id}`}
        rowActions={(t) => (
          <TicketRowActions ticketId={t.id} currentStatus={t.status} currentPriority={t.priority} />
        )}
        emptyState={{
          icon: MessageSquare,
          title: "No tickets match",
          hint: "Try clearing filters.",
        }}
      />

      <Pagination page={tickets.page} hasNext={tickets.hasNext} buildHref={buildPageHref} />
    </div>
  );
}
