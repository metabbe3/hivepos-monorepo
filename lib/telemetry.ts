export type TelemetryKind = any;
export const TELEMETRY_KINDS: any[] = [];
// ponytail: no telemetry/peripheral backend in hivepos-api yet. Return zero-filled
// defaults so the /super-admin/peripherals page renders empty states instead of crashing
// on null. Migrate GET /api/super-admin/peripherals (+ telemetry capture) when wired.
export async function getTelemetryStats(...a: any[]) {
  return { total: 0, byKind: [] } as any;
}
export async function getRecentTelemetry(...a: any[]) { return [] as any; }
export async function getPrinterStats(...a: any[]) {
  return { total: 0, ok: 0, failed: 0, successRate: 0, p50Ms: 0, p95Ms: 0 } as any;
}
export async function getPrinterMethodStats(...a: any[]) { return [] as any; }
export async function getSlowQueries(...a: any[]) { return [] as any; }
export async function getWebVitals(...a: any[]) { return [] as any; }
