import { ConflictError } from "./app-error";

/**
 * Prisma error code for a unique-constraint violation.
 *
 * Encoded as a literal here so callers don't need to import Prisma's runtime
 * just to compare against a string constant.
 */
export const PRISM_UNIQUE_VIOLATION_CODE = "P2002";

/**
 * Detect whether a thrown value is a Prisma unique-constraint violation.
 *
 * Prisma errors are not `instanceof Prisma.PrismaClientKnownRequestError`
 * across module boundaries (the runtime export can be duplicated), so we
 * rely on the duck-typed shape: `{ code: "P2002" }`.
 */
export function isPrismaUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === PRISM_UNIQUE_VIOLATION_CODE
  );
}

/**
 * If `error` is a Prisma unique-constraint violation, throw a `ConflictError`
 * with the supplied message. Otherwise re-throw the original error unchanged.
 *
 * Replaces the duplicated `try { ... } catch (error) { if (error?.code === "P2002") throw new ConflictError(...) }`
 * pattern that appears across services.
 */
export function mapPrismaUniqueError(
  error: unknown,
  message: string,
): never {
  if (isPrismaUniqueViolation(error)) {
    throw new ConflictError(message);
  }
  throw error;
}
