/**
 * Client-side idempotency key generator.
 *
 * Used for offline-created orders + customers. The same clientId is sent
 * with the eventual POST request via X-Client-Id header; the server returns
 * the existing record if already created, so retries / double-submits are
 * safe.
 */
export function newClientId(): string {
  // ponytail: crypto.randomUUID is available in all evergreen browsers and
  // in Node 19+. If it ever returns undefined (very old browser), fall back
  // to a timestamp+random string — collision-resistant enough for the
  // single-device UMKM use case.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Short human-readable label for receipts and UI: first 6 chars of the
 * clientId uppercased. e.g. "a7f3b2c1-..." → "PENDING-A7F3B2".
 */
export function shortPendingId(clientId: string): string {
  return `PENDING-${clientId.slice(0, 6).toUpperCase()}`;
}
