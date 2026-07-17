import { describe, it, expect } from "vitest";
import {
  BUSINESS_MODULES,
  isBusinessModule,
  type BusinessModule,
} from "./business-module";

describe("BUSINESS_MODULES", () => {
  it("contains all four business modules in canonical order", () => {
    expect(BUSINESS_MODULES).toEqual(["LAUNDRY", "FNB", "SALON", "CLEANING"]);
  });

  it("has length 4 (no drift if a new module is added without updating tests)", () => {
    expect(BUSINESS_MODULES.length).toBe(4);
  });
});

describe("isBusinessModule", () => {
  it("returns true for LAUNDRY", () => {
    expect(isBusinessModule("LAUNDRY")).toBe(true);
  });

  it("returns true for FNB", () => {
    expect(isBusinessModule("FNB")).toBe(true);
  });

  it("returns true for SALON", () => {
    expect(isBusinessModule("SALON")).toBe(true);
  });

  it("returns true for CLEANING", () => {
    expect(isBusinessModule("CLEANING")).toBe(true);
  });

  it("returns false for an unknown string", () => {
    expect(isBusinessModule("RESTAURANT")).toBe(false);
  });

  it("returns false for lowercase variants (matching is exact)", () => {
    expect(isBusinessModule("laundry")).toBe(false);
  });

  it("returns false for the empty string", () => {
    expect(isBusinessModule("")).toBe(false);
  });

  it("narrows the type so it can be assigned to BusinessModule", () => {
    const input: string = "FNB";
    if (isBusinessModule(input)) {
      const module: BusinessModule = input;
      expect(module).toBe("FNB");
    } else {
      throw new Error("should have narrowed");
    }
  });
});
