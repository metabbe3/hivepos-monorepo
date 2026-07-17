"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, ApiClientError } from "@/modules/shared";

/**
 * Generic CRUD resource hook for simple list pages (users, branches,
 * services, expenses, ...). Encapsulates the useState/useEffect/apiFetch
 * boilerplate that's duplicated across every CRUD page.
 *
 * Not appropriate for pages with complex filtering/sorting/pagination —
 * the laundry orders page (7 filters) deliberately does NOT use this hook.
 *
 *   const { items, loading, error, refresh, create, update, remove } =
 *     useCrudResource<User>("/api/users");
 *
 * Mutations (create/update/remove) trigger a refresh automatically. Callers
 * that want optimistic UI can call `refresh()` themselves afterwards.
 */
export interface UseCrudResourceOptions<T> {
  /** Base endpoint, e.g. "/api/users". GET lists, POST creates, PATCH updates, DELETE removes. */
  endpoint: string;
  /** Optional transform applied to the response data before storing. */
  mapResponse?: (raw: T[] | undefined | null) => T[];
  /** When provided, the hook re-runs the GET whenever these values change. */
  dependsOn?: readonly unknown[];
  /** When false, suspends the initial fetch (default true). */
  enabled?: boolean;
}

export interface UseCrudResourceResult<T> {
  items: T[];
  loading: boolean;
  error: string | null;
  /** Re-runs the GET request. */
  refresh: () => Promise<void>;
  /** POSTs to the endpoint and refreshes. Returns the created entity. */
  create: (body: unknown) => Promise<T>;
  /** PATCHes {endpoint}/{id} and refreshes. Returns the updated entity. */
  update: (id: string, body: unknown) => Promise<T>;
  /** DELETEs {endpoint}/{id} and refreshes. */
  remove: (id: string) => Promise<void>;
}

export function useCrudResource<T>({
  endpoint,
  mapResponse,
  dependsOn = [],
  enabled = true,
}: UseCrudResourceOptions<T>): UseCrudResourceResult<T> {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState<boolean>(enabled);
  const [error, setError] = useState<string | null>(null);
  const [bump, setBump] = useState(0);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<T[]>(endpoint);
      const next = mapResponse ? mapResponse(res.data) : (res.data ?? []);
      setItems(next);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Request failed");
      setItems([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, enabled, bump, ...dependsOn]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const triggerRefresh = () => setBump((b) => b + 1);

  const create = useCallback(
    async (body: unknown) => {
      const res = await apiFetch<T>(endpoint, { method: "POST", body });
      triggerRefresh();
      return res.data;
    },
    [endpoint],
  );

  const update = useCallback(
    async (id: string, body: unknown) => {
      const res = await apiFetch<T>(`${endpoint}/${id}`, {
        method: "PATCH",
        body,
      });
      triggerRefresh();
      return res.data;
    },
    [endpoint],
  );

  const remove = useCallback(async (id: string) => {
    await apiFetch(`${endpoint}/${id}`, { method: "DELETE" });
    triggerRefresh();
  }, []);

  return { items, loading, error, refresh, create, update, remove };
}
