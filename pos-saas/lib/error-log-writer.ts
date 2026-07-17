/**
 * Server-only ErrorLog writer. Imported and registered at app boot from a
 * server-only entry point (lib/register-error-log-writer.ts), so the writer
 * itself can transitively import Prisma without pulling it into any client
 * bundle that consumes @/modules/shared (withErrorHandler).
 *
 * The registry is intentionally minimal: a single optional callback. The
 * handler in modules/shared/http/api-handler.ts checks `getErrorLogWriter()`
 * at runtime and calls it only when set, only on 5xx, only in non-browser
 * runtimes. No static import path links the two.
 */
export type ErrorLogInput = {
  requestId: string;
  method: string;
  url: string;
  httpStatus: number;
  code: string;
  message: string;
  stack?: string | null;
  tenantId?: string | null;
  userId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

type Writer = (input: ErrorLogInput) => void;

const GLOBAL_KEY = Symbol.for("pos-saas.errorLogWriter");

type GlobalStore = { [k: symbol]: Writer | null };

function store(): GlobalStore {
  // globalThis is shared across all module instances in the same JS process,
  // including the instrumentation runtime vs route-handler runtime, which
  // resolve `@/lib/error-log-writer` to separate module instances under
  // Next.js standalone + turbopack. Module-level `let` is per-instance;
  // globalThis is process-wide.
  return globalThis as unknown as GlobalStore;
}

export function registerErrorLogWriter(w: Writer): void {
  store()[GLOBAL_KEY] = w;
}

export function getErrorLogWriter(): Writer | null {
  return store()[GLOBAL_KEY] ?? null;
}
