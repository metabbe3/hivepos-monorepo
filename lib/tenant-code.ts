// ponytail: derive a short uppercase code from tenant.slug for use in order
// numbers (HBL-20260621-0001). Pure function, no DB.
//
// Ceiling: collisions possible across tenants with same initials (e.g., two
// "Honey Bee Laundry" tenants both → HBL). System has 1 tenant today. When
// N grows, add a Tenant.code column with a uniqueness check at create time
// and surface a manual override UI.
export function deriveTenantCode(slug: string): string {
  const parts = slug.split("-").filter(Boolean);
  if (parts.length === 0) return "ORD";
  if (parts.length === 1) {
    return parts[0].slice(0, 3).toUpperCase();
  }
  return parts
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 5);
}
