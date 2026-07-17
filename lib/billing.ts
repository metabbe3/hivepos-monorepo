// ponytail: stub — billing logic lives in the Go backend. Type/const names kept for compile compat.
export const PRICE_PER_OUTLET = 49000;
export const PRO_PRICE_PER_OUTLET = 79000;
export const ORIGINAL_PRICE_PER_OUTLET = 99000;
export const TRIAL_DAYS = 14;
export const FREE_TIER = "FREE" as const;
export type TenantPlan = any;
export type OutletStatus = any;
export type OutletCoverage = any;
export type OutletCoverageSummary = any;
export type PromoValidationResult = any;
export type BillCalculation = any;
export type LimitType = any;
export type LimitCheckResult = any;
export function addMonths(...a: any[]) { return null as any; }
export async function resolveTrialPlan(...a: any[]) { return null as any; }
export async function calculateBill(...a: any[]) { return null as any; }
export async function getTenantPlan(...a: any[]) { return null as any; }
export async function getTierUnitPrice(...a: any[]) { return 0 as any; }
