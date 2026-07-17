import { describe, it, expect } from "vitest";
import { apiSuccess, apiCreated, apiError } from "./response";
import { NotFoundError, ValidationError } from "../errors/app-error";
import {
  isErrorEnvelope,
  isSuccessEnvelope,
} from "./response";

describe("apiSuccess", () => {
  it("wraps data in the success envelope with default 200", async () => {
    const res = apiSuccess({ id: 1, name: "Order" });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ success: true, data: { id: 1, name: "Order" } });
  });

  it("includes meta when provided", async () => {
    const res = apiSuccess([], { page: 1, total: 0, totalPages: 0 });
    const body = await res.json();
    expect(body.meta).toEqual({ page: 1, total: 0, totalPages: 0 });
  });

  it("omits meta when not provided", async () => {
    const res = apiSuccess({ ok: true });
    const body = await res.json();
    expect(body.meta).toBeUndefined();
  });
});

describe("apiCreated", () => {
  it("returns 201 with the success envelope", async () => {
    const res = apiCreated({ id: "abc" });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ id: "abc" });
  });
});

describe("apiError", () => {
  it("maps an AppError to the error envelope with the right status", async () => {
    const err = new NotFoundError("Order", "xyz");
    const res = apiError(err);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "Order not found (id: xyz)",
      },
    });
  });

  it("includes details for validation errors", async () => {
    const err = new ValidationError("Bad input", {
      details: [
        { field: "name", message: "required" },
        { field: "amount", message: "must be positive" },
      ],
    });
    const res = apiError(err);
    const body = await res.json();
    expect(body.error.details).toEqual([
      { field: "name", message: "required" },
      { field: "amount", message: "must be positive" },
    ]);
  });
});

describe("envelope type guards", () => {
  it("isSuccessEnvelope identifies success responses", () => {
    expect(isSuccessEnvelope({ success: true, data: {} })).toBe(true);
    expect(isSuccessEnvelope({ success: false, error: {} })).toBe(false);
    expect(isSuccessEnvelope(null)).toBe(false);
    expect(isSuccessEnvelope({})).toBe(false);
  });

  it("isErrorEnvelope identifies error responses", () => {
    expect(
      isErrorEnvelope({ success: false, error: { code: "X", message: "y" } }),
    ).toBe(true);
    expect(isErrorEnvelope({ success: true, data: {} })).toBe(false);
    expect(isErrorEnvelope(null)).toBe(false);
  });
});
