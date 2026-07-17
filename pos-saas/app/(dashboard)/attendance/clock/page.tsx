"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, ApiClientError } from "@/modules/shared";
import { useTranslation } from "@/hooks/use-translation";
import { useFeatureFlag } from "@/hooks/use-feature-flag";
import { toast } from "sonner";
import { Delete, Loader2, LogIn, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { formatDuration } from "@/lib/format";
import { Clock3 } from "lucide-react";

// Bolder kiosk: live clock + committed status band + avatar grid. The page IS a
// time-clock station — make it feel like one. Amplification within the indigo +
// emerald system (no new tokens, no new deps).

type StaffStatus = { id: string; name: string; since: string | null; todayMs: number };
type ClockResult = { type: "CLOCK_IN" | "CLOCK_OUT"; userName: string; sessionMs?: number };

const PIN_PAD = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

export default function AttendanceClockPage() {
  const enabled = useFeatureFlag("staffAttendance");
  const { t, lang } = useTranslation();
  const [status, setStatus] = useState<StaffStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<StaffStatus | null>(null);
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const lastActionRef = useRef<{ userId: string; pin: string } | null>(null);

  // 1s tick — drives the live clock + durations.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const r = await apiFetch<StaffStatus[]>("/api/attendance/status");
      setStatus(r.data ?? []);
    } catch { /* session/flag issue */ } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (enabled) void refresh();
    else setLoading(false);
  }, [enabled, refresh]);

  // Keyboard input (0-9 + backspace; no Enter → no accidental clock-out).
  useEffect(() => {
    if (!selected) return;
    const handler = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) setPin((p) => (p.length < 4 ? p + e.key : p));
      else if (e.key === "Backspace") { e.preventDefault(); setPin((p) => p.slice(0, -1)); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selected]);

  const nowDate = new Date(now);
  const timeStr = nowDate.toLocaleTimeString(lang === "id" ? "id-ID" : "en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const dateStr = nowDate.toLocaleDateString(lang === "id" ? "id-ID" : "en-US", { weekday: "long", day: "numeric", month: "long" });
  const timeFmt = (iso: string) =>
    new Date(iso).toLocaleTimeString(lang === "id" ? "id-ID" : "en-US", { hour: "2-digit", minute: "2-digit" });

  const press = (d: string) => {
    if (d === "del") setPin((p) => p.slice(0, -1));
    else if (d && pin.length < 4) setPin((p) => p + d);
  };

  const submit = async () => {
    if (!selected || pin.length < 4) return;
    setSubmitting(true);
    try {
      const r = await apiFetch<ClockResult>("/api/attendance/clock", {
        method: "POST",
        body: { userId: selected.id, pin },
      });
      const label = r.data.type === "CLOCK_IN" ? t("attendance.clockIn") : t("attendance.clockOut");
      const dur = r.data.type === "CLOCK_OUT" && r.data.sessionMs ? ` (${formatDuration(r.data.sessionMs, lang)})` : "";
      if (r.data.type === "CLOCK_OUT") lastActionRef.current = { userId: selected.id, pin };
      toast.success(`${label} — ${r.data.userName}${dur}`, {
        duration: 8000,
        action: r.data.type === "CLOCK_OUT" ? {
          label: lang === "id" ? "Urungkan" : "Undo",
          onClick: () => {
            if (!lastActionRef.current) return;
            apiFetch<ClockResult>("/api/attendance/clock", { method: "POST", body: lastActionRef.current })
              .then(() => { toast.success(t("attendance.clockIn")); void refresh(); })
              .catch(() => {});
            lastActionRef.current = null;
          },
        } : undefined,
      });
      setSelected(null);
      setPin("");
      void refresh();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : t("attendance.wrongPin"));
    } finally {
      setSubmitting(false);
    }
  };

  if (!enabled) return null;

  // Sort: clocked-in first, then alphabetical.
  const sorted = [...status].sort((a, b) => {
    if (a.since && !b.since) return -1;
    if (!a.since && b.since) return 1;
    return a.name.localeCompare(b.name);
  });
  const inNow = sorted.filter((s) => s.since !== null);
  const selectedIsIn = selected?.since !== null;

  return (
    <div className="space-y-6">
      {/* Live clock header — monospace LED kiosk display with indigo glow */}
      <div
        className="relative overflow-hidden rounded-2xl bg-foreground p-6 text-background"
        style={{ backgroundImage: "radial-gradient(ellipse at top right, rgba(99,102,241,0.18), transparent 55%)" }}
      >
        <div className="relative flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-lg font-semibold text-background/70">{t("attendance.title")}</h1>
            <p className="text-sm text-background/50">{dateStr}</p>
          </div>
          <p className="sa-tnum font-mono text-4xl font-bold tracking-wider tabular-nums sm:text-5xl">{timeStr}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Clocked-in band — committed emerald, prominent */}
          {inNow.length > 0 ? (
            <div className="rounded-2xl bg-emerald-500 p-4 text-white shadow-lg shadow-emerald-500/20">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-emerald-50">
                {t("attendance.whoIn")} · {inNow.length}
              </p>
              <div className="flex flex-wrap gap-2">
                {inNow.map((s) => (
                  <span key={s.id} className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-3 py-1.5 backdrop-blur-sm">
                    <span className="h-2.5 w-2.5 rounded-full bg-white" />
                    <span className="text-sm font-bold">{s.name}</span>
                    <span className="sa-tnum text-xs text-emerald-50">
                      {timeFmt(s.since!)} · {formatDuration(now - new Date(s.since!).getTime(), lang)}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {/* Staff grid — avatar + decisive state */}
          {sorted.length === 0 ? (
            <EmptyState icon={Clock3} title={t("attendance.title")} description={t("attendance.noStaff")} />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {sorted.map((s) => {
                const in_ = s.since !== null;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => { setSelected(s); setPin(""); }}
                    className={`flex h-24 flex-col items-center justify-center gap-2 rounded-2xl text-center transition-all active:scale-95 ${
                      in_
                        ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20"
                        : "border-2 border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
                    }`}
                  >
                    {/* ACTION — the dominant element (what happens when you tap) */}
                    <span className="flex items-center gap-1.5 text-base font-extrabold uppercase tracking-wide">
                      {in_ ? <LogOut className="h-5 w-5" /> : <LogIn className="h-5 w-5" />}
                      {in_ ? t("attendance.clockOut") : t("attendance.clockIn")}
                    </span>
                    {/* CONTEXT — name + status (secondary) */}
                    <span className={`sa-tnum text-xs font-medium ${in_ ? "text-emerald-50" : "text-primary/60"}`}>
                      {s.name}{in_ ? ` · ${formatDuration(s.todayMs, lang)}` : (s.todayMs > 0 ? ` · ${formatDuration(s.todayMs, lang)}` : "")}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* PIN pad dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) { setSelected(null); setPin(""); } }}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-center gap-2 text-center">
              {selectedIsIn ? <LogOut className="h-5 w-5 text-destructive" /> : <LogIn className="h-5 w-5 text-primary" />}
              {selectedIsIn ? t("attendance.clockOut") : t("attendance.clockIn")}
            </DialogTitle>
            <p className="text-center text-sm font-medium text-muted-foreground">
              {selected?.name} · {t("attendance.enterPin")}
            </p>
          </DialogHeader>
          <div className="space-y-4">
            {/* PIN dots — fixed 4 */}
            <div className="flex justify-center gap-3">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={`h-3.5 w-3.5 rounded-full transition-colors ${i < pin.length ? "bg-primary" : "bg-muted"}`} />
              ))}
            </div>
            {/* Keypad */}
            <div className="grid grid-cols-3 gap-2">
              {PIN_PAD.map((d, i) =>
                d === "" ? (
                  <span key={i} />
                ) : (
                  <button
                    key={i}
                    type="button"
                    onClick={() => press(d)}
                    className="flex h-16 items-center justify-center rounded-xl border border-border bg-card text-xl font-bold transition-all hover:bg-accent/60 active:scale-90"
                  >
                    {d === "del" ? <Delete className="h-5 w-5" /> : d}
                  </button>
                ),
              )}
            </div>
            <Button
              onClick={submit}
              disabled={pin.length < 4 || submitting}
              className="w-full"
              size="lg"
              variant={selectedIsIn ? "destructive" : "default"}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {selectedIsIn ? t("attendance.clockOut") : t("attendance.clockIn")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
