// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

// Mock usePermissionGuard before importing the hook under test.
vi.mock("./use-permission-guard", () => ({
  usePermissionGuard: vi.fn(),
}));

import { usePermissionGuard } from "./use-permission-guard";
import { useGuardedPage } from "./use-guarded-page";

describe("useGuardedPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shouldRender=true when allowed && !isLoading", () => {
    vi.mocked(usePermissionGuard).mockReturnValue({
      allowed: true,
      isLoading: false,
    });
    const { result } = renderHook(() => useGuardedPage("users", "read"));
    expect(result.current.shouldRender).toBe(true);
    expect(result.current.allowed).toBe(true);
    expect(result.current.isLoading).toBe(false);
  });

  it("shouldRender=false when isLoading=true (even if allowed)", () => {
    vi.mocked(usePermissionGuard).mockReturnValue({
      allowed: true,
      isLoading: true,
    });
    const { result } = renderHook(() => useGuardedPage("users", "read"));
    expect(result.current.shouldRender).toBe(false);
  });

  it("shouldRender=false when allowed=false && !isLoading", () => {
    vi.mocked(usePermissionGuard).mockReturnValue({
      allowed: false,
      isLoading: false,
    });
    const { result } = renderHook(() => useGuardedPage("users", "read"));
    expect(result.current.shouldRender).toBe(false);
  });

  it("shouldRender=false when both allowed=false && isLoading=true", () => {
    vi.mocked(usePermissionGuard).mockReturnValue({
      allowed: false,
      isLoading: true,
    });
    const { result } = renderHook(() => useGuardedPage("users", "read"));
    expect(result.current.shouldRender).toBe(false);
  });

  it("forwards resource, action, and redirectTo to usePermissionGuard", () => {
    vi.mocked(usePermissionGuard).mockReturnValue({
      allowed: true,
      isLoading: false,
    });
    renderHook(() => useGuardedPage("billing", "edit", "/custom-redirect"));
    expect(usePermissionGuard).toHaveBeenCalledWith(
      "billing",
      "edit",
      "/custom-redirect",
    );
  });

  it("defaults redirectTo to /dashboard when not provided", () => {
    vi.mocked(usePermissionGuard).mockReturnValue({
      allowed: true,
      isLoading: false,
    });
    renderHook(() => useGuardedPage("reports", "read"));
    expect(usePermissionGuard).toHaveBeenCalledWith(
      "reports",
      "read",
      "/dashboard",
    );
  });
});
