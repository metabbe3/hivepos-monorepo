import { describe, it, expect } from "vitest";
import { PAPER_WIDTHS, getLineWidth } from "./printer-shared";

describe("getLineWidth", () => {
  it("returns the characters-per-line for known paper sizes", () => {
    expect(getLineWidth("80mm")).toBe(48);
    expect(getLineWidth("58mm")).toBe(32);
    expect(getLineWidth("56mm")).toBe(30);
  });

  it("defaults to 80mm (48) when no size is given", () => {
    expect(getLineWidth(undefined)).toBe(48);
  });

  it("falls back to 48 for an unknown paper size", () => {
    expect(getLineWidth("99mm")).toBe(48);
  });
});

describe("PAPER_WIDTHS", () => {
  it("matches the values used by both printer emit paths", () => {
    expect(PAPER_WIDTHS).toEqual({ "56mm": 30, "58mm": 32, "80mm": 48 });
  });
});
