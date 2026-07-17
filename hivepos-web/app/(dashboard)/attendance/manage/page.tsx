"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/modules/shared";
import { useTranslation } from "@/hooks/use-translation";
import { useFeatureFlag } from "@/hooks/use-feature-flag";
import { useGuardedPage } from "@/hooks/use-guarded-page";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoading } from "@/components/shared/loading";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDuration } from "@/lib/format";

type Event = {
  id: string; userId: string; userName: string;
  type: "CLOCK_IN" | "CLOCK_OUT"; timestamp: string;
  branchId: string; branchName: string;
};
type Session = {
  inEvent?: Event; outEvent?: Event;
  userId: string; userName: string; branchName: string;
};
type Staff = { id: string; name: string };

const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function pairEvents(events: Event[]): Session[] {
  const byUser = new Map<string, Event[]>();
  for (const e of events) {
    const arr = byUser.get(e.userId) ?? [];
    arr.push(e);
    byUser.set(e.userId, arr);
  }
  const sessions: Session[] = [];
  for (const userEvents of byUser.values()) {
    userEvents.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    let openIn: Event | null = null;
    for (const e of userEvents) {
      if (e.type === "CLOCK_IN") {
        if (openIn) sessions.push({ inEvent: openIn, userId: openIn.userId, userName: openIn.userName, branchName: openIn.branchName });
        openIn = e;
      } else {
        sessions.push({ inEvent: openIn ?? undefined, outEvent: e, userId: (openIn ?? e).userId, userName: (openIn ?? e).userName, branchName: (openIn ?? e).branchName });
        openIn = null;
      }
    }
    if (openIn) sessions.push({ inEvent: openIn, userId: openIn.userId, userName: openIn.userName, branchName: openIn.branchName });
  }
  sessions.sort((a, b) => (b.inEvent?.timestamp ?? b.outEvent?.timestamp ?? "").localeCompare(a.inEvent?.timestamp ?? a.outEvent?.timestamp ?? ""));
  return sessions;
}

export default function AttendanceManagePage() {
  const enabled = useFeatureFlag("staffAttendance");
  const { shouldRender } = useGuardedPage("attendance", "edit");
  const { t, lang } = useTranslation();
  const confirm = useConfirm();
  const [events, setEvents] = useState<Event[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10); });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [addOpen, setAddOpen] = useState(false);
  const [addUserId, setAddUserId] = useState("");
  const [addType, setAddType] = useState<"CLOCK_IN" | "CLOCK_OUT">("CLOCK_IN");
  const [addTime, setAddTime] = useState(toLocalInput(new Date().toISOString()));
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiFetch<Event[]>(`/api/attendance/events?from=${from}&to=${to}`);
      setEvents(r.data ?? []);
    } catch { setEvents([]); } finally { setLoading(false); }
  }, [from, to]);

  useEffect(() => {
    if (shouldRender && enabled) {
      void refresh();
      apiFetch<Staff[]>("/api/attendance/staff").then((r) => setStaff(r.data ?? [])).catch(() => {});
    } else { setLoading(false); }
  }, [shouldRender, enabled, refresh]);

  const saveTimestamp = async (id: string, value: string) => {
    try {
      await apiFetch(`/api/attendance/events/${id}`, { method: "PATCH", body: { timestamp: new Date(value).toISOString() } });
      toast.success(t("attendance.eventSaved"));
    } catch { toast.error(t("common.networkError")); }
  };

  const deleteSession = async (s: Session) => {
    const ok = await confirm({ title: t("attendance.confirmDeleteEvent"), destructive: true, confirmLabel: t("common.delete") });
    if (!ok) return;
    if (s.inEvent) await apiFetch(`/api/attendance/events/${s.inEvent.id}`, { method: "DELETE" }).catch(() => {});
    if (s.outEvent) await apiFetch(`/api/attendance/events/${s.outEvent.id}`, { method: "DELETE" }).catch(() => {});
    toast.success(t("attendance.eventDeleted"));
    void refresh();
  };

  const addManual = async () => {
    if (!addUserId || !addTime) return;
    setSaving(true);
    try {
      await apiFetch("/api/attendance/events", { method: "POST", body: { userId: addUserId, type: addType, timestamp: new Date(addTime).toISOString() } });
      toast.success(t("attendance.manualAdded"));
      setAddOpen(false);
      void refresh();
    } catch { toast.error(t("common.networkError")); }
    finally { setSaving(false); }
  };

  if (!enabled || !shouldRender) return null;
  if (loading) return <PageLoading />;

  const sessions = pairEvents(events);

  // Group by date for the diary layout.
  const byDate = new Map<string, Session[]>();
  for (const s of sessions) {
    const ref = s.inEvent ?? s.outEvent;
    if (!ref) continue;
    const date = ref.timestamp.slice(0, 10);
    const arr = byDate.get(date) ?? [];
    arr.push(s);
    byDate.set(date, arr);
  }
  const dateEntries = [...byDate.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  // Summary: total hours + session count.
  let totalMs = 0;
  for (const s of sessions) {
    if (s.inEvent && s.outEvent) totalMs += new Date(s.outEvent.timestamp).getTime() - new Date(s.inEvent.timestamp).getTime();
  }

  const fmtDate = (d: string) =>
    new Date(d + "T00:00").toLocaleDateString(lang === "id" ? "id-ID" : "en-US", { weekday: "long", day: "numeric", month: "short" });

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("attendance.manage")}
        action={{ label: t("attendance.addManual"), onClick: () => { setAddUserId(staff[0]?.id ?? ""); setAddOpen(true); } }}
      />

      {/* Date filter */}
      <div className="flex items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-auto" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-auto" />
        </div>
        <Button variant="outline" size="sm" onClick={() => void refresh()}>Refresh</Button>
      </div>

      {/* Summary bar */}
      {sessions.length > 0 ? (
        <div className="flex items-center gap-6 rounded-xl bg-muted/40 px-5 py-3">
          <div>
            <p className="sa-tnum text-2xl font-bold">{formatDuration(totalMs, lang)}</p>
            <p className="text-xs text-muted-foreground">{t("attendance.hoursWorked")}</p>
          </div>
          <div className="h-8 w-px bg-border" />
          <div>
            <p className="sa-tnum text-2xl font-bold">{sessions.length}</p>
            <p className="text-xs text-muted-foreground">Sessions</p>
          </div>
        </div>
      ) : null}

      {/* Timesheet diary — grouped by date, NOT a table */}
      {sessions.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{t("attendance.noEvents")}</p>
      ) : (
        <div className="space-y-6">
          {dateEntries.map(([date, daySessions]) => (
            <div key={date}>
              {/* Date header — big, bold, the diary identity */}
              <div className="mb-2 flex items-center gap-3">
                <h3 className="text-sm font-bold tracking-tight">{fmtDate(date)}</h3>
                <span className="h-px flex-1 bg-border" />
                <span className="sa-tnum text-xs text-muted-foreground">
                  {daySessions.length} session{daySessions.length > 1 ? "s" : ""}
                </span>
              </div>

              {/* Session cards */}
              <div className="space-y-2">
                {daySessions.map((s, i) => {
                  const inTime = s.inEvent ? toLocalInput(s.inEvent.timestamp) : "";
                  const outTime = s.outEvent ? toLocalInput(s.outEvent.timestamp) : "";
                  const isOpen = !s.outEvent;
                  const duration = s.inEvent && s.outEvent
                    ? formatDuration(new Date(s.outEvent.timestamp).getTime() - new Date(s.inEvent.timestamp).getTime(), lang)
                    : null;
                  const initials = s.userName.charAt(0).toUpperCase();
                  return (
                    <div
                      key={`${s.userId}-${i}`}
                      className={`flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center ${
                        isOpen ? "border-emerald-300/60 bg-emerald-50/30" : "border-border bg-card"
                      }`}
                    >
                      {/* Avatar + name */}
                      <div className="flex items-center gap-2.5 sm:w-36 shrink-0">
                        <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${isOpen ? "bg-emerald-500 text-white" : "bg-primary/10 text-primary"}`}>
                          {initials}
                        </span>
                        <span className="truncate text-sm font-semibold">{s.userName}</span>
                      </div>

                      {/* IN → OUT times */}
                      <div className="flex flex-1 flex-wrap items-center gap-2">
                        {s.inEvent ? (
                          <input
                            type="datetime-local"
                            defaultValue={inTime}
                            onBlur={(e) => { if (e.target.value && e.target.value !== inTime) void saveTimestamp(s.inEvent!.id, e.target.value); }}
                            className="rounded-lg border border-border/60 bg-transparent px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                          />
                        ) : (
                          <span className="rounded-lg px-2 py-1 text-sm text-muted-foreground">—</span>
                        )}
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        {s.outEvent ? (
                          <input
                            type="datetime-local"
                            defaultValue={outTime}
                            onBlur={(e) => { if (e.target.value && e.target.value !== outTime) void saveTimestamp(s.outEvent!.id, e.target.value); }}
                            className="rounded-lg border border-border/60 bg-transparent px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                          />
                        ) : isOpen ? (
                          <Badge variant="outline" className="border-emerald-300 text-emerald-600">Active</Badge>
                        ) : (
                          <span className="rounded-lg px-2 py-1 text-sm text-muted-foreground">—</span>
                        )}
                      </div>

                      {/* Duration + delete */}
                      <div className="flex items-center gap-3 sm:shrink-0">
                        {duration ? (
                          <span className="sa-tnum rounded-lg bg-muted/50 px-2.5 py-1 text-xs font-bold">{duration}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deleteSession(s)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Manual add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("attendance.addManual")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Staff</Label>
              <select value={addUserId} onChange={(e) => setAddUserId(e.target.value)} className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm">
                {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <select value={addType} onChange={(e) => setAddType(e.target.value as "CLOCK_IN" | "CLOCK_OUT")} className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm">
                <option value="CLOCK_IN">{t("attendance.clockIn")}</option>
                <option value="CLOCK_OUT">{t("attendance.clockOut")}</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("attendance.dateTime")}</Label>
              <Input type="datetime-local" value={addTime} onChange={(e) => setAddTime(e.target.value)} />
            </div>
            <Button onClick={addManual} disabled={!addUserId || !addTime || saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              {t("common.confirm")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
