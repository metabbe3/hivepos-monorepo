/**
 * Shared kernel — cross-cutting infrastructure used by every domain module.
 *
 * Re-exports the error framework, HTTP envelope helpers, and logger so routes
 * and services can import from a single entry point:
 *
 *   import { withErrorHandler, parseBody, NotFoundError, logger } from "@/modules/shared";
 */

export * from "./domain";
export * from "./errors";
export * from "./http";
export * from "./logging";
export * from "./serialization";
