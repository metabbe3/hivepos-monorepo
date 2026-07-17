import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch, ApiClientError } from "./client";

// apiFetch is the one piece with branching logic — leave a check behind.
const fetchMock = vi.spyOn(globalThis, "fetch");
afterEach(() => fetchMock.mockReset());

describe("apiFetch", () => {
  it("unwraps a success envelope into { data, meta }", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: { status: "ok" }, meta: { page: 1 } }), {
        status: 200,
      }),
    );
    const res = await apiFetch<{ status: string }>("/health");
    expect(res.data).toEqual({ status: "ok" });
    expect(res.meta?.page).toBe(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/health",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("throws ApiClientError on an error envelope", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: false, error: { code: "BAD", message: "nope" } }), {
        status: 400,
      }),
    );
    await expect(apiFetch("/x")).rejects.toMatchObject({
      name: "ApiClientError",
      code: "BAD",
      httpStatus: 400,
      message: "nope",
    });
    expect(ApiClientError).toBeDefined();
  });

  it("throws when body is set (sends Content-Type + serialized body)", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: { id: 1 } }), { status: 200 }),
    );
    await apiFetch("/orders", { method: "POST", body: { a: 1 } });
    const [, init] = fetchMock.mock.calls[0];
    expect(init?.method).toBe("POST");
    expect((init?.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect(init?.body).toBe(JSON.stringify({ a: 1 }));
  });
});
