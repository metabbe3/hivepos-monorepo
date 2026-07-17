"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, CalendarDays, Ban, RefreshCw, DollarSign, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, ApiClientError } from "@/modules/shared";

interface PlanOption {
  id: string;
  name: string;
  priceMonthly: number;
}

interface SubscriptionInfo {
  status: string | null;
  planId: string | null;
  planName: string | null;
  currentPeriodEnd: string | null;
  paidOutletCount: number;
}

export function SubscriptionManager({
  tenantId,
  info,
  plans,
}: {
  tenantId: string;
  info: SubscriptionInfo;
  plans: PlanOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Per-op form fields
  const [days, setDays] = useState("14");
  const [planId, setPlanId] = useState(info.planId ?? plans[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [months, setMonths] = useState("1");
  const [outletCount, setOutletCount] = useState(String(info.paidOutletCount || 1));

  async function submit(op: string) {
    const trimmed = reason.trim();
    if (trimmed.length < 10) {
      toast.error("Alasan terlalu pendek — minimal 10 huruf.");
      return;
    }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = { op, reason: trimmed };
      if (op === "extend_trial") body.days = Number(days);
      if (op === "change_plan") body.planId = planId;
      if (op === "mark_paid") {
        body.amount = Number(amount);
        body.months = Number(months);
        body.outletCount = Number(outletCount);
      }

      await apiFetch(`/api/super-admin/tenants/${tenantId}/subscription`, {
        method: "PATCH",
        body,
      });
      toast.success(`Subscription updated (${actions.find((x) => x.key === op)?.label ?? op})`);
      setOpen(null);
      setReason("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setReason("");
    setOpen(null);
  }

  const actions = [
    { key: "extend_trial", label: "Extend Trial", icon: CalendarDays, color: "default" as const, description: "Add trial days to current period end" },
    { key: "change_plan", label: "Change Plan", icon: RefreshCw, color: "default" as const, description: "Switch to a different plan" },
    { key: "mark_paid", label: "Mark Paid (manual)", icon: DollarSign, color: "default" as const, description: "Record an offline payment — extends coverage" },
    { key: "cancel", label: "Cancel Subscription", icon: Ban, color: "destructive" as const, description: "Set status to CANCELED (tenant remains active)" },
  ];

  return (
    <section className="rounded-xl bg-card p-6 ring-1 ring-foreground/10 shadow-sm">
      <h2 className="mb-1 text-lg font-bold">Manage Subscription</h2>
      <p className="mb-4 text-xs text-muted-foreground">
        Status: <span className="font-semibold">{info.status ?? "none"}</span>
        {info.planName && <> · Plan: <span className="font-semibold">{info.planName}</span></>}
        {info.currentPeriodEnd && <> · Until: <span className="font-semibold">{new Date(info.currentPeriodEnd).toLocaleDateString("id-ID")}</span></>}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {actions.map((a) => {
          const Icon = a.icon;
          const isOpen = open === a.key;
          return (
            <div key={a.key} className="rounded-xl border border-border">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : a.key)}
                className="flex w-full items-center gap-3 p-3 text-left hover:bg-muted/30 transition-colors"
              >
                <Icon className={`h-4 w-4 ${a.color === "destructive" ? "text-destructive" : "text-primary"}`} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{a.label}</div>
                  <div className="text-xs text-muted-foreground">{a.description}</div>
                </div>
                {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </button>

              {isOpen && (
                <div className="border-t border-border p-4 space-y-3">
                  {a.key === "extend_trial" && (
                    <Field label="Days to add">
                      <Input type="number" min={1} max={365} value={days} onChange={(e) => setDays(e.target.value)} />
                    </Field>
                  )}
                  {a.key === "change_plan" && (
                    <Field label="New plan">
                      <select
                        value={planId}
                        onChange={(e) => setPlanId(e.target.value)}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        {plans.map((p) => (
                          <option key={p.id} value={p.id}>{p.name} — Rp {p.priceMonthly.toLocaleString("id-ID")}/bln</option>
                        ))}
                      </select>
                    </Field>
                  )}
                  {a.key === "mark_paid" && (
                    <>
                      <div className="grid grid-cols-3 gap-2">
                        <Field label="Amount (Rp)">
                          <Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="150000" />
                        </Field>
                        <Field label="Months">
                          <Input type="number" min={1} value={months} onChange={(e) => setMonths(e.target.value)} />
                        </Field>
                        <Field label="Outlets">
                          <Input type="number" min={1} value={outletCount} onChange={(e) => setOutletCount(e.target.value)} />
                        </Field>
                      </div>
                    </>
                  )}
                  {a.key === "cancel" && (
                    <p className="text-xs text-muted-foreground">
                      Subscription will be marked CANCELED. Tenant remains active — use Suspend separately if you want to block access.
                    </p>
                  )}

                  <Field label={`Reason ${a.color === "destructive" ? "*" : ""}`}>
                    <Textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="e.g. Customer called to request extension, ref ticket #123"
                      rows={2}
                    />
                  </Field>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={a.color}
                      onClick={() => submit(a.key)}
                      disabled={submitting}
                    >
                      {submitting && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                      Confirm
                    </Button>
                    <Button size="sm" variant="ghost" onClick={reset} disabled={submitting}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
