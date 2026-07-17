/**
 * Business module discriminator — the vertical a tenant operates in.
 *
 * Declared in the shared domain kernel so every bounded context (orders,
 * pickup-requests, services, …) can reference a single canonical type instead
 * of re-defining the union locally. Mirrors the Prisma `BusinessModule` enum
 * but lives here so the domain layer stays free of infrastructure imports.
 */
export type BusinessModule = "LAUNDRY" | "FNB" | "SALON" | "CLEANING";

/** All valid business modules, in canonical display order. */
export const BUSINESS_MODULES: readonly BusinessModule[] = [
  "LAUNDRY",
  "FNB",
  "SALON",
  "CLEANING",
] as const;

/**
 * Type guard: narrow an arbitrary string to `BusinessModule`.
 *
 * Useful when reading the active module off a session or query string where
 * the static type is still `string`.
 */
export function isBusinessModule(value: string): value is BusinessModule {
  return (
    value === "LAUNDRY" ||
    value === "FNB" ||
    value === "SALON" ||
    value === "CLEANING"
  );
}
