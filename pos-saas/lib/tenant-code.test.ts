import { describe, it, expect } from "vitest";
import { deriveTenantCode } from "./tenant-code";

describe("deriveTenantCode", () => {
  it("uses the first letters of a multi-word slug, uppercased", () => {
    expect(deriveTenantCode("honey-bee-laundry")).toBe("HBL");
    expect(deriveTenantCode("honey-bee")).toBe("HB");
  });

  it("takes the first 3 chars of a single-word slug", () => {
    expect(deriveTenantCode("acme")).toBe("ACM");
  });

  it("keeps fewer than 3 chars when the word is short", () => {
    expect(deriveTenantCode("ab")).toBe("AB");
  });

  it("caps multi-word codes at 5 characters", () => {
    expect(deriveTenantCode("a-b-c-d-e")).toBe("ABCDE");
    expect(deriveTenantCode("a-b-c-d-e-f")).toBe("ABCDE");
  });

  it("falls back to 'ORD' for empty / separator-only slugs", () => {
    expect(deriveTenantCode("")).toBe("ORD");
    expect(deriveTenantCode("---")).toBe("ORD");
  });

  it("handles already-uppercase input", () => {
    expect(deriveTenantCode("Honey-Bee")).toBe("HB");
  });
});
