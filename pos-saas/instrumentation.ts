/**
 * Next.js server runtime entry. Runs once when the server boots.
 * Used to register the ErrorLog writer so withErrorHandler can persist 5xx
 * errors without statically coupling @/modules/shared to lib/prisma.
 *
 * Ponytail: instrumentation runs in both edge and node runtimes; the writer
 * import is server-only and safe here.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Fail-closed: never boot production with a missing/placeholder auth secret
    // — a default secret makes session JWTs forgeable. The operator MUST set a
    // real AUTH_SECRET; otherwise the container exits loudly here.
    if (process.env.NODE_ENV === "production") {
      const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
      if (
        !secret ||
        secret === "change-this-in-production" ||
        secret === "dev-secret-change-in-production"
      ) {
        throw new Error(
          "Refusing to boot: AUTH_SECRET must be set to a real value in production.",
        );
      }
    }

    const { ensureErrorLogWriterRegistered } = await import(
      "@/lib/register-error-log-writer"
    );
    ensureErrorLogWriterRegistered();
  }
}
