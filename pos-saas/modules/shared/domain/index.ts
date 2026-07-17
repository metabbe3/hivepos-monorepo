/**
 * Shared domain kernel — canonical types used across bounded contexts.
 *
 * Each bounded context (orders, customers, …) has its own `domain/types.ts`
 * for module-specific types, but anything referenced by multiple modules
 * belongs here so we have a single source of truth.
 */

export * from "./business-module";
