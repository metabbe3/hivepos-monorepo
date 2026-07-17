"use client";

import { useEffect, useMemo, useState } from "react";
import { ScrollText } from "lucide-react";
import { apiFetch } from "@/modules/shared";
import { formatDateTime } from "@/lib/format";
import { CsvExportButton } from "@/components/shared/csv-export-button";
import { AuditActionBadge } from "@/components/super-admin/audit-action-badge";
import {
  PageHeader,
  Toolbar,
  DataTable,
  type Column,
} from "@/components/super-admin";

const TARGET_FILTERS = [
  { key: "ALL", label: "All" },
  { key: "Tenant", label: "Tenants" },
  { key: "SaaSPayment", label: "Payments" },
  { key: "User", label: "Users" },
] as const;

interface AuditRow {
  id: string;
  createdAt: string;
  action: string;
  actorEmail: string;
  targetType: string;
  targetId: string;
  reason?: string | null;
}

export default function SuperAdminAuditLogPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [targetType, setTargetType] = useState<string>("ALL");

  useEffect(() => {
    apiFetch<AuditRow[]>("/api/super-admin/audit-log")
      .then(({ data }) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setRows([]));
  }, []);

  const filtered = useMemo(
    () => (targetType === "ALL" ? rows : rows.filter((r) => r.targetType === targetType)),
    [rows, targetType],
  );

  const columns: Column<AuditRow>[] = [
    {
      key: "time",
      header: "Time",
      render: (r) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</span>
      ),
    },
    { key: "action", header: "Action", render: (r) => <AuditActionBadge action={r.action} /> },
    { key: "actor", header: "Actor", render: (r) => <span className="text-muted-foreground">{r.actorEmail}</span> },
    {
      key: "target",
      header: "Target",
      render: (r) => (
        <span className="font-mono text-xs text-muted-foreground">
          {r.targetType}:{r.targetId?.slice(0, 8)}
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
        left={
          <div className="flex items-center gap-1">
            {TARGET_FILTERS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTargetType(t.key)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  targetType === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        }
        right={<CsvExportButton url="/api/super-admin/audit-log/export" />}
      />

      <DataTable
        columns={columns}
        rows={filtered}
        getRowKey={(r) => r.id}
        emptyState={{
          icon: ScrollText,
          title: targetType !== "ALL" ? "No events for this filter" : "No audit events yet",
          hint: targetType !== "ALL" ? "Try All." : "Events will appear here.",
        }}
      />
    </div>
  );
}
