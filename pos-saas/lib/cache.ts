/**
 * Minimal in-process TTL cache. Single-instance only (the Docker deploy runs
 * one app container) — add Redis if we ever scale horizontally.
 *
 * `V` must not be `undefined` (use `null` for "not found") — `undefined` is the
 * internal "miss" sentinel. Keys can be any value `Map` accepts (string/number).
 *
 * Reused by the service-catalog + plans caches. The older tenant-cache +
 * feature-flag-cache predate this helper and are left as-is (working code).
 */
export function makeTtlCache<K, V>(ttlMs: number) {
  const store = new Map<K, { value: V; expiresAt: number }>();

  const get = (key: K): V | undefined => {
    const hit = store.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt < Date.now()) {
      store.delete(key);
      return undefined;
    }
    return hit.value;
  };

  const set = (key: K, value: V): void => {
    store.set(key, { value, expiresAt: Date.now() + ttlMs });
  };

  return {
    get,
    set,
    /** Read-through: return cached, or load → cache → return. */
    async getOrSet(key: K, loader: () => Promise<V>): Promise<V> {
      const hit = get(key);
      if (hit !== undefined) return hit;
      const value = await loader();
      set(key, value);
      return value;
    },
    invalidate(key: K): void {
      store.delete(key);
    },
    clear(): void {
      store.clear();
    },
  };
}
