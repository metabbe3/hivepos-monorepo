import type { BusinessModule } from "@/app/generated/prisma/enums";

const VALID_MODULES: BusinessModule[] = ["LAUNDRY", "FNB", "SALON", "CLEANING"];

/**
 * Map lowercase session module ("laundry") to Prisma enum value ("LAUNDRY").
 * Falls back to LAUNDRY for unknown/missing values.
 */
export function sessionModule(s: string | undefined | null): BusinessModule {
  const v = (s ?? "laundry").toUpperCase();
  return (VALID_MODULES as string[]).includes(v)
    ? (v as BusinessModule)
    : "LAUNDRY";
}
