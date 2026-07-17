import { formatCurrency } from "@/lib/format";

export interface FastCashOption {
  label: string;
  amount: number;
  isExact: boolean;
}

const DENOMINATIONS = [5000, 10000, 20000, 50000, 100000, 200000, 500000];

export function generateFastCashOptions(total: number): FastCashOption[] {
  if (total <= 0) return [];

  const options: FastCashOption[] = [
    { label: "Uang Pas", amount: total, isExact: true },
  ];

  for (const denom of DENOMINATIONS) {
    const rounded = Math.ceil(total / denom) * denom;
    if (rounded > total && !options.some((o) => o.amount === rounded)) {
      options.push({ label: formatCurrency(rounded), amount: rounded, isExact: false });
    }
    if (options.length >= 4) break;
  }

  return options;
}
