// Curated major Indonesian cities for the /laundry directory. The FE matches a tenant's
// free-text branch address against these keywords (case-insensitive substring) to group
// tenants into per-city pages. There is no structured city column (schema changes are
// Prisma-only, out of Go scope), so address matching is the honest path.
// ponytail: keyword match is best-effort — a tenant only appears under a city whose keyword
// its address contains. Add cities here as the tenant base grows into new regions.
export interface LaundryCity {
  slug: string;
  name: string;
  keywords: string[];
}

export const LAUNDRY_CITIES: LaundryCity[] = [
  { slug: "jakarta", name: "Jakarta", keywords: ["jakarta", "dki"] },
  { slug: "bandung", name: "Bandung", keywords: ["bandung"] },
  { slug: "surabaya", name: "Surabaya", keywords: ["surabaya"] },
  { slug: "bekasi", name: "Bekasi", keywords: ["bekasi"] },
  { slug: "tangerang", name: "Tangerang", keywords: ["tangerang"] },
  { slug: "depok", name: "Depok", keywords: ["depok"] },
  { slug: "bogor", name: "Bogor", keywords: ["bogor"] },
  { slug: "semarang", name: "Semarang", keywords: ["semarang"] },
  { slug: "yogyakarta", name: "Yogyakarta", keywords: ["yogyakarta", "jogja"] },
  { slug: "malang", name: "Malang", keywords: ["malang"] },
  { slug: "medan", name: "Medan", keywords: ["medan"] },
  { slug: "palembang", name: "Palembang", keywords: ["palembang"] },
  { slug: "makassar", name: "Makassar", keywords: ["makassar", "ujung pandang"] },
  { slug: "balikpapan", name: "Balikpapan", keywords: ["balikpapan"] },
  { slug: "samarinda", name: "Samarinda", keywords: ["samarinda"] },
];

export function cityBySlug(slug: string): LaundryCity | undefined {
  return LAUNDRY_CITIES.find((c) => c.slug === slug);
}

// Match a free-text address to a city (first keyword hit wins). Case-insensitive substring.
export function matchCity(address: string | null | undefined): LaundryCity | undefined {
  if (!address) return undefined;
  const a = address.toLowerCase();
  return LAUNDRY_CITIES.find((c) => c.keywords.some((k) => a.includes(k)));
}
