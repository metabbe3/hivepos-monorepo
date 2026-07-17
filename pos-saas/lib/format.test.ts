import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  formatCurrency,
  formatCompactCurrency,
  formatDate,
  formatDateTime,
  formatRelative,
} from "./format";

// id-ID currency separates "Rp" from the number with a non-breaking space
// (U+00A0, or U+202F on newer ICU). Build the chars from char codes and strip
// them so assertions are stable across Node/ICU versions (no literal bytes).
const NBSP = String.fromCharCode(0xa0);
const NARROW_NBSP = String.fromCharCode(0x202f);
const norm = (s: string) => s.split(NBSP).join(" ").split(NARROW_NBSP).join(" ");
const EM = String.fromCharCode(0x2014);

describe("formatCurrency", () => {
  it("formats thousands with the id-ID grouping and Rp prefix", () => {
    expect(norm(formatCurrency(1500))).toBe("Rp 1.500");
    expect(norm(formatCurrency(1234567))).toBe("Rp 1.234.567");
  });

  it("accepts numeric strings", () => {
    expect(norm(formatCurrency("25000"))).toBe("Rp 25.000");
  });

  it("falls back to 'Rp 0' for non-numeric input", () => {
    expect(norm(formatCurrency(NaN))).toBe("Rp 0");
    expect(norm(formatCurrency("abc" as unknown as number))).toBe("Rp 0");
  });
});

describe("formatCompactCurrency", () => {
  it("returns 'Rp 0' for zero and NaN", () => {
    expect(formatCompactCurrency(0)).toBe("Rp 0");
    expect(formatCompactCurrency(NaN)).toBe("Rp 0");
  });

  it("compacts thousands to 'rb'", () => {
    expect(formatCompactCurrency(25000)).toBe("Rp 25rb");
  });

  it("compacts millions to 'jt' and strips a trailing .0", () => {
    expect(formatCompactCurrency(1_500_000)).toBe("Rp 1.5jt");
    expect(formatCompactCurrency(2_000_000)).toBe("Rp 2jt");
  });

  it("compacts billions to 'M'", () => {
    expect(formatCompactCurrency(3_000_000_000)).toBe("Rp 3M");
  });

  it("prefixes a minus sign for negatives", () => {
    expect(formatCompactCurrency(-5000)).toBe("-Rp 5rb");
  });
});

describe("formatDate / formatDateTime", () => {
  const d = new Date(2026, 5, 25, 14, 30); // local time → TZ-stable date part

  it("formatDate renders day, short month, and year", () => {
    const out = formatDate(d);
    expect(out).toContain("25");
    expect(out).toContain("Jun");
    expect(out).toContain("2026");
  });

  it("formatDateTime renders the date plus a time component", () => {
    const out = formatDateTime(d);
    expect(out).toContain("2026");
    // id-ID uses a period as the time separator (14.30); accept either separator.
    expect(out).toMatch(/14[.:]30/);
  });
});

describe("formatRelative", () => {
  const NOW = new Date(2026, 5, 25, 12, 0, 0).getTime();

  beforeEach(() => vi.spyOn(Date, "now").mockReturnValue(NOW));
  afterEach(() => vi.restoreAllMocks());

  it("returns an em dash for null/undefined", () => {
    expect(formatRelative(null)).toBe(EM);
    expect(formatRelative(undefined)).toBe(EM);
  });

  it("renders 'just now' for recent dates", () => {
    expect(formatRelative(new Date(NOW - 5_000))).toBe("just now");
  });

  it("renders minutes, hours, and days ago", () => {
    expect(formatRelative(new Date(NOW - 5 * 60_000))).toBe("5m ago");
    expect(formatRelative(new Date(NOW - 3 * 3_600_000))).toBe("3h ago");
    expect(formatRelative(new Date(NOW - 2 * 86_400_000))).toBe("2d ago");
  });

  it("falls back to an absolute date beyond 30 days", () => {
    const out = formatRelative(new Date(NOW - 40 * 86_400_000));
    expect(out).toContain("2026");
  });
});
