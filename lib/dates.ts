/**
 * Date helpers used across modules.
 *
 * Centralized so the "end of day" convention (23:59:59.999 local) and the
 * common date-range parsing logic aren't re-implemented per call site.
 */

/**
 * Mutate `d` in place to the last instant of its day (23:59:59.999) and
 * return it. Mirrors the previous `d.setHours(23, 59, 59, 999)` pattern,
 * so callers can use either `endOfDay(d)` or `const e = endOfDay(new Date(x))`.
 */
export function endOfDay(d: Date): Date {
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Parse an optional `{ from?, to? }` string pair into Date bounds.
 *
 * - `from` is parsed as-is (start of that day, as encoded).
 * - `to` is adjusted to end-of-day so the upper bound is inclusive.
 *
 * Returns an empty object when neither bound is provided.
 */
export function parseDateRange(input: {
  from?: string | null;
  to?: string | null;
}): { from?: Date; to?: Date } {
  const result: { from?: Date; to?: Date } = {};
  if (input.from) result.from = new Date(input.from);
  if (input.to) result.to = endOfDay(new Date(input.to));
  return result;
}

/**
 * Interpret a `YYYY-MM-DD` string pair as **WIB (UTC+7) calendar days** and
 * return UTC-instant bounds for a Prisma `gte`/`lte` filter.
 *
 * Why this exists: `new Date("2026-07-01")` parses a date-only string as
 * **UTC midnight** (ECMAScript spec), not local/WIB. Combined with `endOfDay`
 * (which uses local hours), date-range filters drifted ~7h, so "this month" /
 * "today" matched the wrong calendar day. The explicit `+07:00` offset makes
 * the bounds correct regardless of the server's system timezone or container
 * tzdata — Indonesia-only app, WIB is the only timezone that matters.
 */
export function wibDateBounds(input: {
  from?: string | null;
  to?: string | null;
}): { gte?: Date; lte?: Date } {
  const out: { gte?: Date; lte?: Date } = {};
  if (input.from) out.gte = new Date(`${input.from}T00:00:00.000+07:00`);
  if (input.to) out.lte = new Date(`${input.to}T23:59:59.999+07:00`);
  return out;
}

/**
 * Format a Date as a **WIB (UTC+7) calendar-day** string `YYYY-MM-DD`.
 *
 * For day-granularity comparisons (e.g. is a payment day on/before/after the
 * order day) where comparing raw instants would be wrong: a date-only string
 * parses to UTC midnight and timestamps carry time-of-day, which together break
 * same-day logic. `en-CA` locale yields ISO `YYYY-MM-DD`.
 */
export function wibDay(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
}
