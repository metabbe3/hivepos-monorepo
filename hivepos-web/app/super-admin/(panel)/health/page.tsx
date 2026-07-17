export const dynamic = "force-dynamic";

import Link from "next/link";
import { Activity, CheckCircle2, XCircle, Database, KeyRound } from "lucide-react";
import { apiFetch } from "@/modules/shared";
import { formatDateTime } from "@/lib/format";
import { AuditActionBadge } from "@/components/super-admin/audit-action-badge";
import {
  PageHeader,
  StatGrid,
  MetricTile,
  DetailSection,
  DataTable,
  type Column,
} from "@/components/super-admin";

interface AuditRow {
  id: string;
  createdAt: string;
  action: string;
  actorEmail: string;
  targetType: string;
  targetId: string;
}

// DB liveness via the Go backend's public health probe (server-side fetch).
async function pingApi(): Promise<boolean> {
  try {
    await apiFetch("/api/health");
    return true;
  } catch {
    return false;
  }
}

const ENV_CHECKS: { key: string; label: string }[] = [
  { key: "DATABASE_URL", label: "Database URL" },
  { key: "AUTH_SECRET", label: "Auth secret" },
  { key: "MIDTRANS_SERVER_KEY", label: "Midtrans server key" },
  { key: "MIDTRANS_CLIENT_KEY", label: "Midtrans client key" },
  { key: "GOOGLE_CLIENT_ID", label: "Google OAuth (optional)" },
];

export default async function SuperAdminHealthPage() {
  // Audit logs via Go super-admin (endpoint pending — PORT-DEBT §2; graceful empty).
  let recent: AuditRow[] = [];
  const apiOk = await pingApi();
  try {
    const { data } = await apiFetch<AuditRow[] | { rows?: AuditRow[] }>(
      "/api/super-admin/audit-log",
    );
    recent = Array.isArray(data) ? data : (data?.rows ?? []);
  } catch {
    recent = [];
  }

  const envStatus = ENV_CHECKS.map((c) => ({
    ...c,
    set: !!process.env[c.key],
  }));
  const envOk = envStatus.filter((c) => c.set).length;

  type Row = AuditRow;
  const columns: Column<Row>[] = [
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
  ];

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        eyebrow="Monitor"
        title="System Health"
        subtitle="Live system checks — database, configuration, recent activity."
        icon={Activity}
        actions={
          <Link href="/super-admin/audit-log" className="text-xs text-primary hover:underline">
            View full audit log →
          </Link>
        }
      />

      <StatGrid cols={2} className="mb-6">
        <MetricTile
          icon={Database}
          label="Database"
          value={apiOk ? "OK" : "Down"}
          tone={apiOk ? "success" : "danger"}
          sub={apiOk ? "Live probe via /api/health" : "Backend unreachable"}
          index={0}
        />
        <MetricTile
          icon={KeyRound}
          label="Configuration"
          value={
            <>
              <span className="sa-tnum">{envOk}</span>
              <span className="text-muted-foreground">/{envStatus.length}</span>
            </>
          }
          sub="env vars set"
          tone={envOk === envStatus.length ? "success" : "warning"}
          index={1}
        />
      </StatGrid>

      <div className="mb-6">
        <DetailSection title="Environment Variables" icon={KeyRound}>
          <ul className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            {envStatus.map((c) => (
              <li key={c.key} className="flex items-center gap-2">
                {c.set ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
                <span className={c.set ? "text-foreground" : "text-muted-foreground"}>{c.label}</span>
              </li>
            ))}
          </ul>
        </DetailSection>
      </div>

      <DetailSection title="Recent Activity" icon={Activity}>
        <DataTable
          columns={columns}
          rows={recent}
          getRowKey={(r) => r.id}
          emptyState={{ icon: Activity, title: "No events yet", hint: "Events will appear here." }}
        />
      </DetailSection>
    </div>
  );
}
