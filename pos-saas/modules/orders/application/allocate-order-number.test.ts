import { describe, it, expect, vi } from "vitest";
import { allocateOrderNumber } from "./allocate-order-number";

const date = new Date("2025-06-15T00:00:00Z");
const tenantCode = "HBL";
const prefix = "HBL-20250615-";

/** Build a fake Prisma P2002 (unique constraint violation). */
function p2002(): Error {
  const err = new Error("unique constraint failed");
  // ponytail: matches the structural guard in allocate-order-number.ts +
  // modules/shared/errors/error-mapper.ts:21-29.
  Object.assign(err, { code: "P2002" });
  return err;
}

describe("allocateOrderNumber", () => {
  it("commits on the first attempt when there is no race", async () => {
    const getLastSequence = vi.fn<(p: string) => Promise<number>>()
      .mockResolvedValue(4);
    const tryInsert = vi.fn<(n: string) => Promise<{ id: "ok" }>>()
      .mockResolvedValue({ id: "ok" });

    const result = await allocateOrderNumber(
      prefix, date, tenantCode,
      getLastSequence, tryInsert,
    );

    expect(result).toEqual({ id: "ok" });
    expect(getLastSequence).toHaveBeenCalledTimes(1);
    expect(tryInsert).toHaveBeenCalledTimes(1);
    expect(tryInsert).toHaveBeenCalledWith("HBL-20250615-0005");
  });

  it("re-reads the sequence and retries on P2002", async () => {
    // ponytail: reproduces the create-vs-convert race — both read seq=5,
    // both compute 0006, one INSERT wins, the other gets P2002. On retry
    // the read now sees 6 (winner's row is visible) → 0007 succeeds.
    const getLastSequence = vi.fn<(p: string) => Promise<number>>()
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(6);
    const tryInsert = vi.fn<(n: string) => Promise<string>>()
      .mockRejectedValueOnce(p2002())
      .mockResolvedValueOnce("order-id");

    const result = await allocateOrderNumber(
      prefix, date, tenantCode,
      getLastSequence, tryInsert,
    );

    expect(result).toBe("order-id");
    expect(getLastSequence).toHaveBeenCalledTimes(2);
    expect(tryInsert).toHaveBeenCalledWith("HBL-20250615-0006");
    expect(tryInsert).toHaveBeenCalledWith("HBL-20250615-0007");
  });

  it("rethrows a non-P2002 error immediately (no swallow)", async () => {
    const getLastSequence = vi.fn<(p: string) => Promise<number>>()
      .mockResolvedValue(0);
    const other = new Error("connection refused");
    const tryInsert = vi.fn<(n: string) => Promise<string>>()
      .mockRejectedValue(other);

    await expect(
      allocateOrderNumber(prefix, date, tenantCode, getLastSequence, tryInsert),
    ).rejects.toBe(other);

    expect(getLastSequence).toHaveBeenCalledTimes(1);
    expect(tryInsert).toHaveBeenCalledTimes(1);
  });

  it("gives up after MAX_ATTEMPTS (5) consecutive P2002s and rethrows the last", async () => {
    const getLastSequence = vi.fn<(p: string) => Promise<number>>()
      .mockResolvedValue(0);
    const tryInsert = vi.fn<(n: string) => Promise<string>>()
      .mockRejectedValue(p2002());

    await expect(
      allocateOrderNumber(prefix, date, tenantCode, getLastSequence, tryInsert),
    ).rejects.toMatchObject({ code: "P2002" });

    expect(tryInsert).toHaveBeenCalledTimes(5);
  });
});
