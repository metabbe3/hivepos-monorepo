// Re-exported from the shared kernel — see modules/shared/application/context.ts.
// Billing is tenant-scoped (no branchId), so it uses the base TenantRequestContext.
export type { TenantRequestContext as RequestContext } from "@/modules/shared/application/context";
