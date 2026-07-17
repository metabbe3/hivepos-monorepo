import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoist the mock fns above vi.mock so the factory closes over the real fn objects.
const { findMany, deleteMany } = vi.hoisted(() => ({
  findMany: vi.fn(),
  deleteMany: vi.fn(),
}));
const { deletePhoto } = vi.hoisted(() => ({ deletePhoto: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: { orderPhoto: { findMany, deleteMany } },
}));
vi.mock("@/lib/photo-storage", () => ({ deletePhoto }));

import { purgeExpiredPhotos } from "./photo-cleanup";

const NOW = new Date("2026-06-25T12:00:00Z");

beforeEach(() => {
  findMany.mockReset();
  deleteMany.mockReset();
  deletePhoto.mockReset();
  // Default: a successful unlink (resolves). mockReset strips this, so re-set it
  // — otherwise deletePhoto() returns undefined and `.catch` on it throws.
  deletePhoto.mockResolvedValue(undefined);
});

describe("purgeExpiredPhotos", () => {
  it("unlinks the file AND deletes the row for expired photos, returns count", async () => {
    const expired = { id: "e1", storagePath: "t1/ORD1/before-x.webp" };
    findMany.mockResolvedValue([expired]);
    deleteMany.mockResolvedValue({ count: 1 });

    const n = await purgeExpiredPhotos({ now: NOW });

    expect(findMany).toHaveBeenCalledWith({
      where: { expiresAt: { lt: NOW } },
      select: { id: true, storagePath: true },
    });
    expect(deletePhoto).toHaveBeenCalledWith(expired.storagePath);
    expect(deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["e1"] } },
    });
    expect(n).toBe(1);
  });

  it("is a no-op (no unlink, no delete) when nothing is expired", async () => {
    findMany.mockResolvedValue([]);
    const n = await purgeExpiredPhotos({ now: NOW });
    expect(deletePhoto).not.toHaveBeenCalled();
    expect(deleteMany).not.toHaveBeenCalled();
    expect(n).toBe(0);
  });

  it("scopes the sweep to one tenant when tenantId is given (lazy upload purge)", async () => {
    findMany.mockResolvedValue([]);
    await purgeExpiredPhotos({ tenantId: "t9", now: NOW });
    expect(findMany.mock.calls[0][0].where).toEqual({
      expiresAt: { lt: NOW },
      tenantId: "t9",
    });
  });

  it("still deletes the rows when a file unlink fails (best-effort)", async () => {
    // The rejection is caught inside purgeExpiredPhotos (Promise.all + .catch),
    // so no unhandled rejection escapes — the row delete proceeds regardless.
    const a = { id: "a", storagePath: "p/a.webp" };
    const b = { id: "b", storagePath: "p/b.webp" };
    findMany.mockResolvedValue([a, b]);
    deleteMany.mockResolvedValue({ count: 2 });
    deletePhoto.mockRejectedValueOnce(new Error("unlink boom"));

    const n = await purgeExpiredPhotos({ now: NOW });

    expect(deletePhoto).toHaveBeenCalledTimes(2); // both files attempted
    expect(deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["a", "b"] } },
    });
    expect(n).toBe(2);
  });
});
