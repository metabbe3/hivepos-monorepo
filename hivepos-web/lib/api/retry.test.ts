import { describe, expect, it, vi } from "vitest";
import { isTransientError, withRetry } from "./retry";

// ponytail: duck-typed error carrying httpStatus — mirrors ApiClientError without
// the circular import (retry.ts reads httpStatus off the object).
function httpErr(status: number, name = "ApiClientError"): Error & { httpStatus: number } {
  const e = new Error(`status ${status}`) as Error & { httpStatus: number };
  e.name = name;
  e.httpStatus = status;
  return e;
}

describe("isTransientError", () => {
  it("retries network (TypeError) + abort/timeout", () => {
    expect(isTransientError(new TypeError("failed to fetch"))).toBe(true);
    const abort = new Error("aborted"); abort.name = "AbortError";
    expect(isTransientError(abort)).toBe(true);
    const timeout = new Error("timed out"); timeout.name = "TimeoutError";
    expect(isTransientError(timeout)).toBe(true);
  });
  it("retries 429 + 5xx", () => {
    expect(isTransientError(httpErr(429))).toBe(true);
    expect(isTransientError(httpErr(500))).toBe(true);
    expect(isTransientError(httpErr(503))).toBe(true);
  });
  it("never retries 4xx (user-actionable)", () => {
    expect(isTransientError(httpErr(400))).toBe(false);
    expect(isTransientError(httpErr(401))).toBe(false);
    expect(isTransientError(httpErr(403))).toBe(false);
    expect(isTransientError(httpErr(404))).toBe(false);
    expect(isTransientError(httpErr(422))).toBe(false);
  });
});

describe("withRetry", () => {
  it("returns on first success (no retry)", async () => {
    const attempt = vi.fn().mockResolvedValue("ok");
    const res = await withRetry(attempt, isTransientError, { baseMs: 0 });
    expect(res).toBe("ok");
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it("retries transient then succeeds", async () => {
    const attempt = vi
      .fn()
      .mockRejectedValueOnce(httpErr(503))
      .mockRejectedValueOnce(httpErr(500))
      .mockResolvedValueOnce("recovered");
    const res = await withRetry(attempt, isTransientError, { attempts: 3, baseMs: 0 });
    expect(res).toBe("recovered");
    expect(attempt).toHaveBeenCalledTimes(3);
  });

  it("retries network errors (TypeError)", async () => {
    const attempt = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("failed to fetch"))
      .mockResolvedValueOnce("ok");
    const res = await withRetry(attempt, isTransientError, { baseMs: 0 });
    expect(res).toBe("ok");
    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it("throws immediately on 4xx — no retry", async () => {
    const attempt = vi.fn().mockRejectedValue(httpErr(404));
    await expect(withRetry(attempt, isTransientError, { attempts: 3, baseMs: 0 }))
      .rejects.toMatchObject({ httpStatus: 404 });
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it("exhausts attempts on persistent 5xx, throws last error", async () => {
    const attempt = vi.fn().mockRejectedValue(httpErr(500));
    await expect(withRetry(attempt, isTransientError, { attempts: 3, baseMs: 0 }))
      .rejects.toMatchObject({ httpStatus: 500 });
    expect(attempt).toHaveBeenCalledTimes(3);
  });
});
