import { describe, it, expect } from "vitest";
import { endOfDay, parseDateRange } from "./dates";

describe("endOfDay", () => {
  it("mutates the date in place to 23:59:59.999 and returns the same instance", () => {
    const d = new Date(2026, 5, 25, 10, 30, 15, 250); // local time, TZ-stable
    const out = endOfDay(d);
    expect(out).toBe(d);
    expect(out.getHours()).toBe(23);
    expect(out.getMinutes()).toBe(59);
    expect(out.getSeconds()).toBe(59);
    expect(out.getMilliseconds()).toBe(999);
  });
});

describe("parseDateRange", () => {
  it("returns an empty object when neither bound is provided", () => {
    expect(parseDateRange({})).toEqual({});
    expect(parseDateRange({ from: null, to: null })).toEqual({});
  });

  it("parses `from` as-is (no end-of-day adjustment)", () => {
    const { from, to } = parseDateRange({ from: "2026-06-01" });
    expect(from).toEqual(new Date("2026-06-01"));
    expect(to).toBeUndefined();
  });

  it("adjusts `to` to end-of-day so the upper bound is inclusive", () => {
    const { from, to } = parseDateRange({ to: "2026-06-30" });
    expect(from).toBeUndefined();
    expect(to).toEqual(endOfDay(new Date("2026-06-30")));
    expect(to!.getHours()).toBe(23);
    expect(to!.getMilliseconds()).toBe(999);
  });

  it("parses both bounds independently", () => {
    const { from, to } = parseDateRange({ from: "2026-06-01", to: "2026-06-30" });
    expect(from).toEqual(new Date("2026-06-01"));
    expect(to).toEqual(endOfDay(new Date("2026-06-30")));
  });
});
