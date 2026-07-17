/**
 * Prisma update payload that increments a record's `sessionVersion` field.
 *
 * Used by user and role services to invalidate JWTs after permission changes.
 * Centralizing the literal keeps the operation discoverable and prevents a
 * typo'd field name from silently failing to invalidate sessions.
 */
export const SESSION_VERSION_INCREMENT = { increment: 1 } as const;
