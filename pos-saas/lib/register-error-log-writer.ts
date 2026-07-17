/**
 * Server-only bootstrap. Imports the Prisma-backed ErrorLog writer and
 * registers it with the runtime registry so withErrorHandler can persist
 * 5xx errors without statically importing lib/prisma (which would drag the
 * `pg` package into client bundles).
 *
 * Imported from instrumentation.ts (Next.js server runtime hook). Never
 * imported from a component or shared module.
 */
import { registerErrorLogWriter } from "@/lib/error-log-writer";
import { persistErrorLog } from "@/lib/error-logs";

let registered = false;

export function ensureErrorLogWriterRegistered(): void {
  if (registered) return;
  registered = true;
  registerErrorLogWriter(persistErrorLog);
}
