import { describe, it, expect, vi, afterEach } from "vitest";
import { apiFetch, ApiClientError } from "./client";

describe("apiFetch", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns data + meta on a success envelope", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { id: 1 },
            meta: { total: 1 },
          }),
      }),
    );
    const { data, meta } = await apiFetch<{ id: number }>("/api/x");
    expect(data).toEqual({ id: 1 });
    expect(meta?.total).toBe(1);
  });

  it("throws ApiClientError with server code/message on error envelope", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: () =>
          Promise.resolve({
            success: false,
            error: { code: "VALIDATION", message: "bad input" },
          }),
      }),
    );
    await expect(apiFetch("/api/x")).rejects.toMatchObject({
      code: "VALIDATION",
      message: "bad input",
      httpStatus: 422,
    });
  });

  it("throws UNKNOWN ApiClientError on non-envelope response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(null),
      }),
    );
    await expect(apiFetch("/api/x")).rejects.toBeInstanceOf(ApiClientError);
  });

  it("serializes body and sets Content-Type only when body present", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: {} }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await apiFetch("/api/x", { method: "POST", body: { a: 1 } });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/json",
    );
  });
});
