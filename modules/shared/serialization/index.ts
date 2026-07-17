/**
 * Serialization helpers for crossing the Prisma → API boundary.
 *
 * Two patterns appear in nearly every repository and service:
 *   1. `entity.createdAt.toISOString()` — repeated for every Date field on every DTO
 *   2. `Number(prismaDecimal)`         — repeated for every money/Decimal field
 *
 * Centralizing them here keeps behavior consistent (e.g. null handling) and
 * gives the test suite one place to lock down edge cases.
 */

/**
 * Anything Prisma's Decimal (or a plain number) can be converted from.
 * Deliberately structural so we don't need to import @prisma/client here.
 */
export type DecimalLike = { toNumber(): number };

/**
 * Convert a Date to an ISO string, returning null for null/undefined.
 *
 * Use for *nullable* date columns (`finishedAt`, `deletedAt`, …).
 */
export function toIso(date: Date | null | undefined): string | null {
  if (date === null || date === undefined) return null;
  return date.toISOString();
}

/**
 * Convert a required Date to an ISO string.
 *
 * Use for *non-nullable* date columns (`createdAt`, `updatedAt`). Throws
 * narrowly so a silent `undefined` slip doesn't reach the API as `"Invalid Date"`.
 */
export function toIsoRequired(date: Date): string {
  return date.toISOString();
}

/**
 * Convert a Prisma Decimal (or plain number) to a number, returning null for
 * null/undefined inputs. Drop-in replacement for `Number(value)` on money
 * columns where the source may be null.
 */
export function decimalToNumber(
  value: DecimalLike | number | null | undefined,
): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  return value.toNumber();
}

/**
 * Convert a required Prisma Decimal (or plain number) to a number.
 *
 * Use for *non-nullable* money columns where the schema guarantees a value.
 * Throws if the input is null/undefined to surface contract violations loudly.
 */
export function decimalToNumberRequired(value: DecimalLike | number): number {
  if (typeof value === "number") return value;
  return value.toNumber();
}
