import { ScrollText } from "lucide-react";
import { requireSuperAdminPanelSession } from "@/lib/super-admin/permissions";
import { getAuditLogs } from "@/lib/audit-query";
import { formatDateTime } from "@/lib/format";
import { CsvExportButton } from "@/components/shared/csv-export-button";
import { AuditActionBadge } from "@/components/super-admin/audit-action-badge";
import {
  PageHeader,
  FilterBar,
  type FilterGroup,
  DataTable,
  type Column,
  Toolbar,
  Pagination,
} from "@/components/super-admin";

const TARGET_FILTERS = [
  { key: "ALL", label: "All" },
  { key: "Tenant", label: "Tenants" },
  { key: "SaaSPayment", label: "Payments" },
  { key: "User", label: "Users" },
] as const;

const PAGE_SIZE = 50;

export default async function SuperAdminAuditLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSuperAdminPanelSession();

  const sp = await searchParams;
  const targetTypeParam = typeof sp.targetType === "string" ? sp.targetType : undefined;
  const targetType =
    targetTypeParam && targetTypeParam !== "ALL" &&
    (TARGET_FILTERS as readonly { key: string }[]).some((t) => t.key === targetTypeParam)
      ? targetTypeParam
      : undefined;
  const page = Math.max(1, Number(sp.page ?? "1"));

  const result = await getAuditLogs({
    ...(targetType && { targetType }),
    page,
    pageSize: PAGE_SIZE,
  });

  function buildHref(field: string, key: string): string {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (k === field || k === "page" || v === undefined) continue;
      if (typeof v === "string") params.set(k, v);
    }
    if (key !== "ALL") params.set(field, key);
    const qs = params.toString();
    return qs ? `/super-admin/audit-log?${qs}` : "/super-admin/audit-log";
  }

  function buildPageHref(p: number): string {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (k === "page" || v === undefined) continue;
      if (typeof v === "string") params.set(k, v);
    }
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/super-admin/audit-log?${qs}` : "/super-admin/audit-log";
  }

  const filterGroup: FilterGroup = {
    field: "targetType",
    active: targetType ?? "ALL",
    options: TARGET_FILTERS.map((t) => ({ key: t.key, label: t.label })),
  };

  type Row = (typeof result.rows)[number];

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
      key: "action",
      header: "Action",
      render: (r) => <AuditActionBadge action={r.action} />,
    },
    {
      key: "actor",
      header: "Actor",
      render: (r) => <span className="text-muted-foreground">{r.actorEmail}</span>,
    },
    {
      key: "target",
      header: "Target",
      render: (r) => (
        <span className="font-mono text-xs text-muted-foreground">
          {r.targetType}:{r.targetId.slice(0, 8)}
        </span>
      ),
    },
    {
      key: "reason",
      header: "Reason",
      render: (r) => (
        <span className="block max-w-md truncate text-muted-foreground" title={r.reason ?? ""}>
          {r.reason ?? "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        eyebrow="Operations"
        title="Audit Log"
        subtitle="Every privileged action — who did what, to what, when."
        icon={ScrollText}
      />

      <Toolbar
        left={<FilterBar groups={[filterGroup]} buildHref={buildHref} />}
        right={
          <CsvExportButton
            url={`/api/super-admin/audit-log/export${targetType ? `?targetType=${targetType}` : ""}`}
          />
        }
      />

      <DataTable
        columns={columns}
        rows={result.rows}
        getRowKey={(r) => r.id}
        emptyState={{
          icon: ScrollText,
          title: targetType ? "No events for this filter" : "No audit events yet",
          hint: targetType ? "Try All." : "Events will appear here.",
        }}
      />

      <Pagination page={result.page} hasNext={result.hasNext} buildHref={buildPageHref} />
    </div>
  );
}
