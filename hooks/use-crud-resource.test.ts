// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const apiFetchMock = vi.fn();
vi.mock("@/modules/shared", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
  ApiClientError: class ApiClientError extends Error {
    constructor(
      public readonly code: string,
      message: string,
      public readonly httpStatus: number,
    ) {
      super(message);
      this.name = "ApiClientError";
    }
  },
}));

import { useCrudResource } from "./use-crud-resource";
import { ApiClientError } from "@/modules/shared";

interface Item {
  id: string;
  name: string;
}

const items: Item[] = [
  { id: "1", name: "Alice" },
  { id: "2", name: "Bob" },
];

describe("useCrudResource", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("performs an initial GET and exposes items/loading/error", async () => {
    apiFetchMock.mockResolvedValueOnce({ data: items, meta: undefined });
    const { result } = renderHook(() =>
      useCrudResource<Item>({ endpoint: "/api/users" }),
    );

    // Initially loading=true before the fetch resolves.
    expect(result.current.loading).toBe(true);
    expect(result.current.items).toEqual([]);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toEqual(items);
    expect(result.current.error).toBeNull();
    expect(apiFetchMock).toHaveBeenCalledWith("/api/users");
  });

  it("stores an error message when the GET rejects", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiClientError("X", "nope", 500));
    const { result } = renderHook(() =>
      useCrudResource<Item>({ endpoint: "/api/users" }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("nope");
    expect(result.current.items).toEqual([]);
  });

  it("refresh() re-runs the GET request", async () => {
    apiFetchMock.mockResolvedValueOnce({ data: items, meta: undefined });
    const { result } = renderHook(() =>
      useCrudResource<Item>({ endpoint: "/api/users" }),
    );
    await waitFor(() => expect(result.current.items).toEqual(items));

    apiFetchMock.mockResolvedValueOnce({
      data: [{ id: "3", name: "Carol" }],
      meta: undefined,
    });
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.items).toEqual([{ id: "3", name: "Carol" }]);
  });

  it("create() POSTs to the endpoint and refreshes", async () => {
    apiFetchMock.mockResolvedValueOnce({ data: items, meta: undefined });
    const { result } = renderHook(() =>
      useCrudResource<Item>({ endpoint: "/api/users" }),
    );
    await waitFor(() => expect(result.current.items).toEqual(items));

    apiFetchMock
      .mockResolvedValueOnce({ data: { id: "3", name: "Carol" }, meta: undefined }) // POST
      .mockResolvedValueOnce({ data: [...items, { id: "3", name: "Carol" }], meta: undefined }); // GET refresh

    let created: Item | undefined;
    await act(async () => {
      created = await result.current.create({ name: "Carol" });
    });
    expect(created).toEqual({ id: "3", name: "Carol" });
    expect(apiFetchMock).toHaveBeenNthCalledWith(2, "/api/users", {
      method: "POST",
      body: { name: "Carol" },
    });
    expect(result.current.items).toEqual([
      ...items,
      { id: "3", name: "Carol" },
    ]);
  });

  it("update() PATCHes {endpoint}/{id} and refreshes", async () => {
    apiFetchMock.mockResolvedValueOnce({ data: items, meta: undefined });
    const { result } = renderHook(() =>
      useCrudResource<Item>({ endpoint: "/api/users" }),
    );
    await waitFor(() => expect(result.current.items).toEqual(items));

    apiFetchMock
      .mockResolvedValueOnce({ data: { id: "1", name: "Alicia" }, meta: undefined }) // PATCH
      .mockResolvedValueOnce({ data: [{ id: "1", name: "Alicia" }, items[1]], meta: undefined }); // GET

    await act(async () => {
      await result.current.update("1", { name: "Alicia" });
    });
    expect(apiFetchMock).toHaveBeenNthCalledWith(2, "/api/users/1", {
      method: "PATCH",
      body: { name: "Alicia" },
    });
    expect(result.current.items).toEqual([
      { id: "1", name: "Alicia" },
      items[1],
    ]);
  });

  it("remove() DELETEs {endpoint}/{id} and refreshes", async () => {
    apiFetchMock.mockResolvedValueOnce({ data: items, meta: undefined });
    const { result } = renderHook(() =>
      useCrudResource<Item>({ endpoint: "/api/users" }),
    );
    await waitFor(() => expect(result.current.items).toEqual(items));

    apiFetchMock
      .mockResolvedValueOnce({ data: undefined, meta: undefined }) // DELETE (no body)
      .mockResolvedValueOnce({ data: [items[1]], meta: undefined }); // GET refresh

    await act(async () => {
      await result.current.remove("1");
    });
    expect(apiFetchMock).toHaveBeenNthCalledWith(2, "/api/users/1", {
      method: "DELETE",
    });
    expect(result.current.items).toEqual([items[1]]);
  });

  it("applies mapResponse to the response data when provided", async () => {
    apiFetchMock.mockResolvedValueOnce({
      data: [{ id: "1", name: "alice" }],
      meta: undefined,
    });
    const upper = (raw: Item[] | undefined | null): Item[] =>
      (raw ?? []).map((r) => ({ ...r, name: r.name.toUpperCase() }));
    const { result } = renderHook(() =>
      useCrudResource<Item>({ endpoint: "/api/users", mapResponse: upper }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toEqual([{ id: "1", name: "ALICE" }]);
  });

  it("enabled=false skips the initial fetch", async () => {
    apiFetchMock.mockResolvedValue({ data: items, meta: undefined });
    const { result } = renderHook(() =>
      useCrudResource<Item>({ endpoint: "/api/users", enabled: false }),
    );
    // Give any potential fetch a chance to fire (it shouldn't).
    await new Promise((r) => setTimeout(r, 10));
    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(result.current.items).toEqual([]);
  });

  it("re-runs the GET when dependsOn values change", async () => {
    apiFetchMock.mockResolvedValue({ data: items, meta: undefined });
    const { result, rerender } = renderHook(
      ({ dep }: { dep: string }) => useCrudResource<Item>({
        endpoint: `/api/users?x=${dep}`,
        dependsOn: [dep],
      }),
      { initialProps: { dep: "a" } },
    );
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));
    expect(apiFetchMock).toHaveBeenLastCalledWith("/api/users?x=a");

    rerender({ dep: "b" });
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(2));
    expect(apiFetchMock).toHaveBeenLastCalledWith("/api/users?x=b");
  });
});
