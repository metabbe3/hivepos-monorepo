"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { apiFetch } from "@/modules/shared";
import { Badge } from "@/components/ui/badge";

interface ReferralRow {
  id: string;
  status: "PENDING" | "REWARDED" | "REJECTED" | "EXPIRED";
  reason: string | null;
  rewardMonths: number;
  createdAt: string;
  rewardedAt: string | null;
  referrer: { name: string; slug: string; code: string } | null;
  referred: { name: string; slug: string } | null;
}

const STATUS_STYLE: Record<ReferralRow["status"], string> = {
  PENDING: "bg-amber-100 text-amber-700",
  REWARDED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
  EXPIRED: "bg-zinc-100 text-zinc-500",
};

export function ReferralsManager() {
  const [rows, setRows] = useState<ReferralRow[] | null>(null);

  useEffect(() => {
    apiFetch<{ referrals: ReferralRow[] }>("/api/super-admin/referrals")
      .then((r) => setRows(r.data.referrals))
      .catch(() => setRows([]));
  }, []);

  async function voidRef(id: string) {
    if (!confirm("Void this referral? It will never reward (no claw-back of an already-granted reward).")) return;
    try {
      await apiFetch(`/api/super-admin/referrals/${id}`, { method: "PATCH" });
      setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, status: "REJECTED", reason: "voided_by_admin" } : r)) ?? null);
    } catch {
      /* ignore */
    }
  }

  if (rows === null) {
    return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
  }
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No referrals yet.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Referrer</th>
            <th className="px-4 py-3">Referred</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Created</th>
            <th className="px-4 py-3">Reason</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="px-4 py-3">
                <div className="font-medium">{r.referrer?.name ?? "-"}</div>
                <div className="text-xs text-muted-foreground">code: {r.referrer?.code ?? "-"}</div>
              </td>
              <td className="px-4 py-3">{r.referred?.name ?? "-"}</td>
              <td className="px-4 py-3">
                <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[r.status]}`}>
                  {r.status}
                </span>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{r.createdAt.slice(0, 10)}</td>
              <td className="px-4 py-3 text-xs text-muted-foreground">{r.reason ?? "-"}</td>
              <td className="px-4 py-3 text-right">
                {(r.status === "PENDING" || r.status === "EXPIRED") && (
                  <button
                    onClick={() => voidRef(r.id)}
                    className="text-xs font-semibold text-red-600 hover:underline"
                  >
                    Void
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
