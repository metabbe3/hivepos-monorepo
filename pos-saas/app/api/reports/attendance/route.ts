import { withErrorHandler, apiSuccess } from "@/modules/shared";
import { requireWithBranchOrThrow } from "@/lib/permissions/check";
import { prisma } from "@/lib/prisma";

type DaySession = { date: string; inTime: string; outTime: string | null; hoursMs: number; active: boolean };

export const GET = withErrorHandler(async (req) => {
  const ctx = await requireWithBranchOrThrow("attendance", "read");
  const url = new URL(req.url);

  // FIX: date-only params resolve to midnight UTC — events after 07:00 WIB excluded.
  // Force start-of-day / end-of-day in local time.
  const toParam = url.searchParams.get("to");
  const fromParam = url.searchParams.get("from");
  const to = toParam ? new Date(toParam + "T23:59:59") : new Date();
  const from = fromParam
    ? new Date(fromParam + "T00:00:00")
    : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

  const branch = await prisma.branch.findFirst({
    where: { tenantId: ctx.tenantId, isActive: true },
    select: { workDays: true },
  });
  const workDays: number[] = branch?.workDays?.length ? branch.workDays : [1, 2, 3, 4, 5, 6];

  const staff = await prisma.user.findMany({
    where: { tenantId: ctx.tenantId, isActive: true, pinHash: { not: null } },
    select: {
      id: true,
      name: true,
      clockEvents: {
        where: { timestamp: { gte: from, lte: to }, branchId: { in: ctx.branchIds } },
        orderBy: { timestamp: "asc" },
      },
    },
  });

  let totalWorkDays = 0;
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    const jsDay = d.getDay();
    const wd = jsDay === 0 ? 7 : jsDay;
    if (workDays.includes(wd)) totalWorkDays++;
  }

  const now = new Date();
  const rows = staff.map((s) => {
    let hoursMs = 0;
    const daysWorkedSet = new Set<string>();
    let openIn: Date | null = null;

    // Per-day session tracking for the daily breakdown.
    const sessionsByDate = new Map<string, DaySession[]>();

    for (const ev of s.clockEvents) {
      const dateKey = ev.timestamp.toDateString();
      const isoDate = ev.timestamp.toISOString().slice(0, 10);
      const timeStr = ev.timestamp.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

      if (ev.type === "CLOCK_IN") {
        openIn = ev.timestamp;
        daysWorkedSet.add(dateKey);
        const arr = sessionsByDate.get(isoDate) ?? [];
        arr.push({ date: isoDate, inTime: timeStr, outTime: null, hoursMs: 0, active: true });
        sessionsByDate.set(isoDate, arr);
      } else if (ev.type === "CLOCK_OUT" && openIn) {
        hoursMs += ev.timestamp.getTime() - openIn.getTime();
        const arr = sessionsByDate.get(isoDate) ?? [];
        const last = arr[arr.length - 1];
        if (last && last.active) {
          last.outTime = timeStr;
          last.hoursMs = ev.timestamp.getTime() - openIn.getTime();
          last.active = false;
        }
        openIn = null;
      }
    }

    // Count open session up to now.
    if (openIn) {
      hoursMs += now.getTime() - openIn.getTime();
      // Update the last open session's hoursMs.
      for (const arr of sessionsByDate.values()) {
        const last = arr[arr.length - 1];
        if (last && last.active) {
          last.hoursMs = now.getTime() - openIn.getTime();
        }
      }
    }

    const daysWorked = daysWorkedSet.size;
    const noShow = Math.max(0, totalWorkDays - daysWorked);
    const days = [...sessionsByDate.values()].flat().sort((a, b) => b.date.localeCompare(a.date));

    return {
      userId: s.id,
      name: s.name,
      hoursMs,
      hours: +(hoursMs / 3_600_000).toFixed(1),
      daysWorked,
      noShow,
      days,
    };
  });

  return apiSuccess(rows, { from: from.toISOString(), to: to.toISOString(), totalWorkDays });
});
