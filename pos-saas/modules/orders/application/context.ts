// Re-exported from the shared kernel so consumers keep using
// `import { RequestContext, hasPermission } from "./context"`.
// See modules/shared/application/context.ts for the canonical definition.
export type { BranchRequestContext as RequestContext } from "@/modules/shared/application/context";
export { hasPermission } from "@/modules/shared/application/context";
