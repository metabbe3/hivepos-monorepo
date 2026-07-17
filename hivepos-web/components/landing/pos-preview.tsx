import { ArrowUpRight } from "lucide-react";

/**
 * Real component preview of the POS order list — NOT a div-based fake screenshot.
 * Renders actual order rows in the app's real visual language (tabular nums,
 * hairline rows, status chips). On-brand: dogfooding-as-proof (this is a real
 * slice of the product, not a mocked dashboard).
 *
 * ponytail: static sample data — a believable snapshot, not live. Numbers are
 * realistic Indonesian laundry figures; refresh when the dogfood story shifts.
 */

type Status = "Diproses" | "Siap Diambil" | "Selesai";

const ORDERS: { no: string; name: string; service: string; amount: string; status: Status }[] = [
  { no: "0007", name: "Bu Sari", service: "Kiloan · 5 kg", amount: "35.000", status: "Siap Diambil" },
  { no: "0006", name: "Pak Joko", service: "Satuan · 3 pcs", amount: "21.000", status: "Diproses" },
  { no: "0005", name: "Dewi Lestari", service: "Bedcover", amount: "35.000", status: "Selesai" },
  { no: "0004", name: "Rizki", service: "Express · 6 jam", amount: "50.000", status: "Diproses" },
];

function StatusChip({ status }: { status: Status }) {
  // One accent (brand) for the action-needed state; slate for the rest. No rainbow.
  const cls =
    status === "Siap Diambil"
      ? "bg-brand/10 text-brand"
      : status === "Diproses"
        ? "bg-slate-100 text-slate-600"
        : "bg-slate-50 text-slate-400";
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
      {status}
    </span>
  );
}

export function PosPreview() {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* App header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div>
          <p className="text-[11px] font-semibold text-slate-400">
            Honey Bee Laundry
          </p>
          <p className="font-display text-sm font-bold text-slate-900">Pesanan Hari Ini</p>
        </div>
        <div className="text-right">
          <p className="font-display text-2xl font-extrabold leading-none text-slate-900 tabular-nums">
            18
          </p>
          <p className="text-[11px] text-slate-400">order</p>
        </div>
      </div>

      {/* Order rows — real list, hairline dividers */}
      <ul className="divide-y divide-slate-100">
        {ORDERS.map((o) => (
          <li key={o.no} className="flex items-center gap-3 px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-slate-400">HBL-{o.no}</span>
                <span className="truncate text-sm font-semibold text-slate-900">{o.name}</span>
              </div>
              <p className="truncate text-xs text-slate-500">{o.service}</p>
            </div>
            <span className="text-sm font-semibold text-slate-700 tabular-nums">Rp {o.amount}</span>
            <StatusChip status={o.status} />
          </li>
        ))}
      </ul>

      {/* Footer total */}
      <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-4 py-3">
        <div>
          <p className="text-[11px] text-slate-400">Omzet hari ini</p>
          <p className="font-display text-base font-extrabold text-slate-900 tabular-nums">
            Rp 792.000
          </p>
        </div>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand">
          Lihat semua <ArrowUpRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </div>
  );
}
