// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const apiFetchMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();

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

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

import { useDeleteConfirm } from "./use-delete-confirm";
import { ApiClientError } from "@/modules/shared";

describe("useDeleteConfirm", () => {
  let confirmSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    apiFetchMock.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
    confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    confirmSpy.mockRestore();
  });

  it("returns confirmAndDelete and deleting=null initially", () => {
    const { result } = renderHook(() =>
      useDeleteConfirm({
        endpoint: "/api/users",
        successMessage: "deleted",
        errorMessage: "failed",
      }),
    );
    expect(typeof result.current.confirmAndDelete).toBe("function");
    expect(result.current.deleting).toBeNull();
  });

  it("DELETEs {endpoint}/{id}, calls onDeleted, shows success toast, returns true", async () => {
    apiFetchMock.mockResolvedValueOnce({ data: undefined, meta: undefined });
    const onDeleted = vi.fn();
    const { result } = renderHook(() =>
      useDeleteConfirm({
        endpoint: "/api/users",
        successMessage: "deleted",
        errorMessage: "failed",
        onDeleted,
      }),
    );

    let ok = false;
    await act(async () => {
      ok = await result.current.confirmAndDelete("u-1", "Are you sure?");
    });
    expect(ok).toBe(true);
    expect(confirmSpy).toHaveBeenCalledWith("Are you sure?");
    expect(apiFetchMock).toHaveBeenCalledWith("/api/users/u-1", {
      method: "DELETE",
    });
    expect(onDeleted).toHaveBeenCalledWith("u-1");
    expect(toastSuccessMock).toHaveBeenCalledWith("deleted");
    expect(result.current.deleting).toBeNull();
  });

  it("returns false and does NOT call apiFetch when user cancels confirm", async () => {
    confirmSpy.mockReturnValue(false);
    const onDeleted = vi.fn();
    const { result } = renderHook(() =>
      useDeleteConfirm({
        endpoint: "/api/users",
        successMessage: "ok",
        errorMessage: "err",
        onDeleted,
      }),
    );

    let ok = true;
    await act(async () => {
      ok = await result.current.confirmAndDelete("u-1", "Sure?");
    });
    expect(ok).toBe(false);
    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });

  it("shows error toast with ApiClientError.message and returns false on failure", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiClientError("X", "Server boom", 500));
    const onDeleted = vi.fn();
    const { result } = renderHook(() =>
      useDeleteConfirm({
        endpoint: "/api/users",
        successMessage: "ok",
        errorMessage: "fallback err",
        onDeleted,
      }),
    );

    let ok = true;
    await act(async () => {
      ok = await result.current.confirmAndDelete("u-1", "Sure?");
    });
    expect(ok).toBe(false);
    expect(onDeleted).not.toHaveBeenCalled();
    expect(toastErrorMock).toHaveBeenCalledWith("Server boom");
    expect(toastSuccessMock).not.toHaveBeenCalled();
    expect(result.current.deleting).toBeNull();
  });

  it("falls back to errorMessage for non-ApiClientError errors", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("network"));
    const { result } = renderHook(() =>
      useDeleteConfirm({
        endpoint: "/api/users",
        successMessage: "ok",
        errorMessage: "fallback err",
      }),
    );

    let ok = true;
    await act(async () => {
      ok = await result.current.confirmAndDelete("u-1", "Sure?");
    });
    expect(ok).toBe(false);
    expect(toastErrorMock).toHaveBeenCalledWith("fallback err");
  });

  it("sets deleting to the id while the request is in flight, then back to null", async () => {
    let resolveDelete!: (v: unknown) => void;
    apiFetchMock.mockReturnValueOnce(new Promise((r) => { resolveDelete = r; }));
    const { result } = renderHook(() =>
      useDeleteConfirm({
        endpoint: "/api/users",
        successMessage: "ok",
        errorMessage: "err",
      }),
    );

    let confirmPromise!: Promise<boolean>;
    act(() => {
      confirmPromise = result.current.confirmAndDelete("u-99", "Sure?");
    });
    await waitFor(() => expect(result.current.deleting).toBe("u-99"));

    await act(async () => {
      resolveDelete({ data: undefined, meta: undefined });
      await confirmPromise;
    });
    expect(result.current.deleting).toBeNull();
  });
});
