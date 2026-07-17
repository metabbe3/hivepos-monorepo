"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/modules/shared";
import { useTranslation } from "@/hooks/use-translation";
import { useFeatureFlag } from "@/hooks/use-feature-flag";
import { Clock3, ChevronDown, ChevronUp, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageLoading } from "@/components/shared/loading";
import { formatDuration } from "@/lib/format";

type DaySession = { date: string; inTime: string; outTime: string | null; hoursMs: number; active: boolean };
type Row = { userId: string; name: string; hoursMs: number; hours: number; daysWorked: number; noShow: number; days: DaySession[] };

const fmtDate = (iso: string, lang: string) =>
  new Date(iso + "T00:00").toLocaleDateString(lang === "id" ? "id-ID" : "en-US", { weekday: "short", day: "numeric", month: "short" });

function exportCsv(rows: Row[], lang: string) {
  const lines = ["Staff,Date,Clock In,Clock Out,Hours,Status"];
  for (const r of rows) {
    for (const d of r.days) {
      lines.push([
        `"${r.name}"`,
        d.date,
        d.inTime,
        d.outTime ?? "",
        formatDuration(d.hoursMs, lang),
        d.active ? "Active" : "Complete",
      ].join(","));
    }
    // Per-staff total row
    lines.push([`"${r.name}"`, "", "", "", `TOTAL: ${formatDuration(r.hoursMs, lang)}`, `${r.daysWorked} days`].join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `attendance-report-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function AttendanceReport({ from, to }: { from: string; to: string }) {
  const enabled = useFeatureFlag("staffAttendance");
  const { t, lang } = useTranslation();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) { setLoading(false); return; }
    setLoading(true);
    setExpanded(null);
    apiFetch<Row[]>(`/api/reports/attendance?from=${from}&to=${to}`)
      .then((r) => setRows(r.data ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [enabled, from, to]);

  if (!enabled) return null;
  if (loading) return <PageLoading />;
  if (!rows.length) {
    return <EmptyState icon={Clock3} title={t("attendance.report")} description={t("attendance.noStaff")} />;
  }

  const totalMs = rows.reduce((s, r) => s + r.hoursMs, 0);
  const totalDays = rows.reduce((s, r) => s + r.daysWorked, 0);
  const totalNoShow = rows.reduce((s, r) => s + r.noShow, 0);

  return (
    <div className="space-y-3">
      {/* Export */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => exportCsv(rows, lang)}>
          <Download className="h-4 w-4 mr-1.5" />
          CSV
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60">
                <tr className="text-left text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">{t("users.title")}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{t("attendance.hoursWorked")}</th>
                  <th className="px-4 py-2.5 text-right font-medium">Avg/Day</th>
                  <th className="px-4 py-2.5 text-right font-medium">{t("attendance.daysWorked")}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{t("attendance.noShow")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <>
                    <tr
                      key={r.userId}
                      className="border-b border-border/40 cursor-pointer transition-colors hover:bg-accent/30"
                      onClick={() => setExpanded(expanded === r.userId ? null : r.userId)}
                    >
                      <td className="px-4 py-2.5 font-medium">
                        <span className="flex items-center gap-1.5">
                          {expanded === r.userId ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                          {r.name}
                        </span>
                      </td>
                      <td className="sa-tnum px-4 py-2.5 text-right font-semibold">{formatDuration(r.hoursMs, lang)}</td>
                      <td className="sa-tnum px-4 py-2.5 text-right text-muted-foreground">
                        {r.daysWorked > 0 ? formatDuration(r.hoursMs / r.daysWorked, lang) : "—"}
                      </td>
                      <td className="sa-tnum px-4 py-2.5 text-right">{r.daysWorked}</td>
                      <td className={`sa-tnum px-4 py-2.5 text-right font-medium ${r.noShow > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                        {r.noShow}
                      </td>
                    </tr>
                    {/* Daily breakdown — expandable */}
                    {expanded === r.userId && r.days.length > 0 ? (
                      <tr key={r.userId + "-detail"} className="bg-muted/20">
                        <td colSpan={5} className="px-4 py-3">
                          <div className="space-y-1.5">
                            {r.days.map((d, i) => (
                              <div key={i} className="flex items-center gap-4 text-xs">
                                <span className="w-28 shrink-0 font-medium">{fmtDate(d.date, lang)}</span>
                                <span className="sa-tnum w-16 shrink-0 text-muted-foreground">{d.inTime}</span>
                                <span className="text-muted-foreground">→</span>
                                <span className="sa-tnum w-16 shrink-0 text-muted-foreground">
                                  {d.outTime ?? (d.active ? <span className="text-emerald-600 font-medium">active</span> : "—")}
                                </span>
                                <span className="sa-tnum ml-auto font-semibold">{formatDuration(d.hoursMs, lang)}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-border">
                <tr className="font-bold">
                  <td className="px-4 py-2.5">Total</td>
                  <td className="sa-tnum px-4 py-2.5 text-right">{formatDuration(totalMs, lang)}</td>
                  <td className="sa-tnum px-4 py-2.5 text-right text-muted-foreground">
                    {totalDays > 0 ? formatDuration(totalMs / totalDays, lang) : "—"}
                  </td>
                  <td className="sa-tnum px-4 py-2.5 text-right">{totalDays}</td>
                  <td className="sa-tnum px-4 py-2.5 text-right">{totalNoShow}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
