import { describe, it, expect } from "vitest";
import { sessionModule } from "./module-filter";

describe("sessionModule", () => {
  it("maps lowercase session values to the Prisma enum", () => {
    expect(sessionModule("laundry")).toBe("LAUNDRY");
    expect(sessionModule("fnb")).toBe("FNB");
    expect(sessionModule("salon")).toBe("SALON");
    expect(sessionModule("cleaning")).toBe("CLEANING");
  });

  it("passes already-uppercase values through", () => {
    expect(sessionModule("LAUNDRY")).toBe("LAUNDRY");
  });

  it("falls back to LAUNDRY for unknown values", () => {
    expect(sessionModule("unknown")).toBe("LAUNDRY");
    expect(sessionModule("")).toBe("LAUNDRY");
  });

  it("treats null/undefined as laundry (the default)", () => {
    expect(sessionModule(null)).toBe("LAUNDRY");
    expect(sessionModule(undefined)).toBe("LAUNDRY");
  });
});
