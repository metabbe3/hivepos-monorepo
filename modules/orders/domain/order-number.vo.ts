/**
 * Order number generation.
 *
 * Format: `{TENANT_CODE}-YYYYMMDD-XXXX`
 *   - TENANT_CODE derived from tenant.slug via lib/tenant-code (e.g., HBL)
 *   - YYYYMMDD is derived from the receivedAt date (UTC)
 *   - XXXX is a zero-padded sequence (1-based) within that date + tenant
 *
 * The sequence continuation point is provided by the repository (the highest
 * existing number for that date+tenant prefix), keeping this a pure function.
 * Tenant code is unique across the system (slug is unique), so the prefix
 * itself scopes sequence lookups — no separate tenant filter needed in the
 * repository query.
 */

/** Build the date prefix `{tenantCode}-YYYYMMDD-` for a given date. */
export function orderNumberPrefix(date: Date, tenantCode: string): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${tenantCode}-${yyyy}${mm}${dd}-`;
}

/**
 * Generate the next order number given the last one used for the same
 * date + tenant.
 *
 *   generateOrderNumber(new Date("2025-01-15"), 0, "HBL")   → "HBL-20250115-0001"
 *   generateOrderNumber(new Date("2025-01-15"), 3, "HBL")   → "HBL-20250115-0004"
 */
export function generateOrderNumber(
  receivedAt: Date,
  lastSequence: number,
  tenantCode: string,
): string {
  const prefix = orderNumberPrefix(receivedAt, tenantCode);
  const next = lastSequence + 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

/**
 * Parse the sequence number out of an existing order number.
 *
 *   parseSequence("HBL-20250115-0007") → 7
 *   parseSequence("ORD-20250115-0007") → 7  (legacy format still parses)
 *
 * Returns 0 for malformed strings (no sequence suffix).
 */
export function parseSequence(orderNumber: string): number {
  const parts = orderNumber.split("-");
  if (parts.length < 3) return 0;
  const seq = parseInt(parts[parts.length - 1], 10);
  return Number.isNaN(seq) ? 0 : seq;
}
