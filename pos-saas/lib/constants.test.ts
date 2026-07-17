import { describe, it, expect } from "vitest";
import { UNPAID_PAYMENT_STATUSES } from "./constants";

describe("UNPAID_PAYMENT_STATUSES", () => {
  it("contains exactly the two statuses that carry an outstanding balance", () => {
    expect(UNPAID_PAYMENT_STATUSES).toEqual(["PENDING", "PARTIAL"]);
  });

  it("does not include settled/refunded statuses", () => {
    expect(UNPAID_PAYMENT_STATUSES).not.toContain("PAID");
    expect(UNPAID_PAYMENT_STATUSES).not.toContain("REFUNDED");
  });
});
