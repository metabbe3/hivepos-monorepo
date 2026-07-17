import Link from "next/link";
import { MessageSquare, Star, Building2, Clock, Tag, AlertTriangle } from "lucide-react";
import { requireSuperAdminPanelSession } from "@/lib/super-admin/permissions";
import { getAdminTicket } from "@/lib/tickets-admin";
import { formatDateTime } from "@/lib/format";
import {
  TICKET_STATUS_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_CATEGORY_LABELS,
} from "@/lib/super-admin/labels";
import { TicketRowActions } from "../ticket-row-actions";
import { TicketReplyBox } from "./ticket-reply-box";
import { DetailShell, DetailSection, StatusPill, type PillTone } from "@/components/super-admin";

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

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSuperAdminPanelSession();
  const { id } = await params;
  const ticket = await getAdminTicket(id);

  return (
    <div className="animate-fade-in-up">
      <DetailShell
        backHref="/super-admin/tickets"
        backLabel="Tickets"
        headerExtra={
          <TicketRowActions
            ticketId={ticket.id}
            currentStatus={ticket.status}
            currentPriority={ticket.priority}
          />
        }
      >
        {/* Header card */}
        <div className="mb-6 rounded-xl bg-card p-6 ring-1 ring-foreground/10 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-xl font-bold tracking-tight">{ticket.subject}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusPill
                  dot
                  tone={STATUS_TONE[ticket.status] ?? "muted"}
                  label={TICKET_STATUS_LABELS[ticket.status] ?? ticket.status}
                />
                <StatusPill
                  tone={PRIORITY_TONE[ticket.priority] ?? "muted"}
                  label={TICKET_PRIORITY_LABELS[ticket.priority] ?? ticket.priority}
                />
                <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                  <Tag className="h-3 w-3" />
                  {TICKET_CATEGORY_LABELS[ticket.category] ?? ticket.category}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" />
              By <strong className="text-foreground">{ticket.submitterName}</strong>
              <span className="text-xs">&lt;{ticket.submitterEmail}&gt;</span>
            </span>
            {ticket.submitterPhone && (
              <span className="text-xs">· {ticket.submitterPhone}</span>
            )}
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {formatDateTime(ticket.createdAt)}
            </span>
            {ticket.resolvedAt && (
              <span>· Resolved {formatDateTime(ticket.resolvedAt)}</span>
            )}
            {ticket.tenantId && (
              <span className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                <Link
                  href={`/super-admin/tenants/${ticket.tenantId}`}
                  className="font-medium text-primary hover:underline"
                >
                  {ticket.tenantName ?? ticket.tenantId}
                </Link>
              </span>
            )}
          </div>

          <div className="mt-4 rounded-xl border border-border/60 bg-muted/30 p-4">
            <p className="whitespace-pre-wrap text-sm">{ticket.description}</p>
          </div>

          {ticket.csatRating !== null && (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/60 dark:bg-amber-950/30">
              <Star className="mt-0.5 h-4 w-4 fill-amber-500 text-amber-500" />
              <div className="text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-amber-500 font-semibold">
                    {"★".repeat(ticket.csatRating)}
                    <span className="text-amber-200">{"★".repeat(5 - ticket.csatRating)}</span>
                  </span>
                  <span className="text-muted-foreground">Rated {ticket.csatRating}/5</span>
                </div>
                {ticket.csatComment && (
                  <p className="mt-1 italic text-muted-foreground">"{ticket.csatComment}"</p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Thread — main column */}
          <div className="lg:col-span-2">
            <DetailSection title={`Thread (${ticket.comments.length})`} icon={MessageSquare}>
              {ticket.comments.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No replies yet.</p>
              ) : (
                <ol className="relative space-y-4 border-l border-border/60 pl-6">
                  {ticket.comments.map((c) => {
                    const isTenant = c.authorRole === "TENANT_USER";
                    const isStaff = c.authorRole === "SUPER_ADMIN" || c.authorRole === "SUPPORT";
                    return (
                      <li key={c.id} className="relative">
                        <span
                          className={`absolute -left-[27px] top-1 flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-background ${
                            isTenant
                              ? "bg-sky-500"
                              : isStaff
                                ? "bg-emerald-500"
                                : "bg-muted-foreground"
                          }`}
                        />
                        <div
                          className={`rounded-xl border p-3 text-sm ${
                            isTenant
                              ? "border-sky-200 bg-sky-50/60 dark:border-sky-900/60 dark:bg-sky-950/20"
                              : "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/60 dark:bg-emerald-950/20"
                          }`}
                        >
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <span className="font-medium">
                              {c.authorName}
                              <span className="ml-2 text-xs font-normal text-muted-foreground">
                                {isTenant ? "Tenant" : isStaff ? "Staff" : c.authorRole}
                              </span>
                            </span>
                            <span className="text-xs text-muted-foreground">{formatDateTime(c.createdAt)}</span>
                          </div>
                          <p className="whitespace-pre-wrap">{c.body}</p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}

              <div className="mt-6">
                <h3 className="mb-2 text-sm font-semibold">Post a Reply</h3>
                <TicketReplyBox ticketId={ticket.id} />
                <p className="mt-2 text-xs text-muted-foreground">
                  Replying auto-sets status to <strong>In Progress</strong> if currently Open.
                </p>
              </div>
            </DetailSection>
          </div>

          {/* Metadata sidebar */}
          <div className="space-y-4">
            <DetailSection title="Details" icon={AlertTriangle}>
              <dl className="space-y-3 text-sm">
                <MetaRow label="Status">
                  <StatusPill dot tone={STATUS_TONE[ticket.status] ?? "muted"} label={TICKET_STATUS_LABELS[ticket.status] ?? ticket.status} />
                </MetaRow>
                <MetaRow label="Priority">
                  <StatusPill tone={PRIORITY_TONE[ticket.priority] ?? "muted"} label={TICKET_PRIORITY_LABELS[ticket.priority] ?? ticket.priority} />
                </MetaRow>
                <MetaRow label="Category">
                  <span className="text-muted-foreground">{TICKET_CATEGORY_LABELS[ticket.category] ?? ticket.category}</span>
                </MetaRow>
                <MetaRow label="Created">
                  <span className="text-right text-xs text-muted-foreground">{formatDateTime(ticket.createdAt)}</span>
                </MetaRow>
                {ticket.resolvedAt && (
                  <MetaRow label="Resolved">
                    <span className="text-right text-xs text-muted-foreground">{formatDateTime(ticket.resolvedAt)}</span>
                  </MetaRow>
                )}
                {ticket.csatRating !== null && (
                  <MetaRow label="CSAT">
                    <span className="text-amber-500 font-semibold">
                      {"★".repeat(ticket.csatRating)}
                      <span className="text-amber-200">{"★".repeat(5 - ticket.csatRating)}</span>
                    </span>
                  </MetaRow>
                )}
              </dl>
            </DetailSection>
          </div>
        </div>
      </DetailShell>
    </div>
  );
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
