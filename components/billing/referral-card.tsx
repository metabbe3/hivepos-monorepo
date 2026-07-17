"use client";

import { useEffect, useState } from "react";
import { Gift, Copy, Check } from "lucide-react";
import { apiFetch } from "@/modules/shared";
import { toast } from "sonner";

interface ReferralData {
  code: string;
  shareUrl: string;
  rewarded: number;
  pending: number;
  cap: number;
  rewardMonths: number;
}

/**
 * Owner-facing referral card (on /billing). Shows their share link + copy +
 * reward stats. Copy is Indonesian to match the billing page's convention.
 */
export function ReferralCard() {
  const [data, setData] = useState<ReferralData | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    apiFetch<ReferralData>("/api/tenant/referral")
      .then((r) => setData(r.data))
      .catch(() => {});
  }, []);

  if (!data) return null;

  function copy() {
    navigator.clipboard.writeText(data!.shareUrl).then(() => {
      setCopied(true);
      toast.success("Link referral disalin!");
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-5">
      <div className="flex items-center gap-2">
        <Gift className="h-5 w-5 text-emerald-600" />
        <h3 className="font-display text-lg font-bold text-slate-900">
          Ajak teman, dapat 1 bulan gratis
        </h3>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        Bagikan link ini ke pemilik laundry lain. Saat mereka daftar dan melakukan
        pembayaran pertama, Anda dan teman Anda masing-masing dapat{" "}
        <strong>1 bulan gratis</strong> per outlet.
      </p>

      <div className="mt-4 flex items-center gap-2">
        <code className="flex-1 truncate rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
          {data.shareUrl}
        </code>
        <button
          onClick={copy}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Disalin" : "Salin"}
        </button>
      </div>

      <p className="mt-3 text-xs text-slate-500">
        {data.rewarded} teman sudah berlangganan • {data.pending} masih dalam trial •
        batas {data.cap} reward.
      </p>
    </div>
  );
}
