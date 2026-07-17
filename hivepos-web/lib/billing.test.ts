import { describe, it, expect } from "vitest";
import { resolveTrialPlan, TRIAL_DAYS, calculateBill } from "./billing";

const NOW = new Date("2026-06-25T12:00:00Z");
const future = (days: number) => new Date(NOW.getTime() + days * 86_400_000);
const past = (days: number) => new Date(NOW.getTime() - days * 86_400_000);

describe("TRIAL_DAYS", () => {
  it("is 14 (matches the landing-page '14 Hari Gratis' claim)", () => {
    expect(TRIAL_DAYS).toBe(14);
  });
});

describe("resolveTrialPlan", () => {
  it("returns the GROWTH trial tier while the window is open", () => {
    expect(resolveTrialPlan({ trialEndsAt: future(10), trialTier: "GROWTH", now: NOW })).toBe("GROWTH");
  });

  it("returns the PRO trial tier when the signup trialed Pro", () => {
    // Honors "Coba Pro 14 Hari Gratis" — website (Pro-only) unlocks during trial.
    expect(resolveTrialPlan({ trialEndsAt: future(5), trialTier: "PRO", now: NOW })).toBe("PRO");
  });

  it("reverts to FREE once trialEndsAt has passed (lazy auto-revert)", () => {
    expect(resolveTrialPlan({ trialEndsAt: past(1), trialTier: "GROWTH", now: NOW })).toBe("FREE");
    expect(resolveTrialPlan({ trialEndsAt: past(1), trialTier: "PRO", now: NOW })).toBe("FREE");
  });

  it("treats trialEndsAt exactly at now as expired (<=)", () => {
    expect(resolveTrialPlan({ trialEndsAt: NOW, trialTier: "GROWTH", now: NOW })).toBe("FREE");
  });

  it("returns FREE when there is no trial window", () => {
    expect(resolveTrialPlan({ trialEndsAt: null, trialTier: "GROWTH", now: NOW })).toBe("FREE");
    expect(resolveTrialPlan({ trialEndsAt: null, trialTier: null, now: NOW })).toBe("FREE");
  });

  it("defaults an unknown/missing trialTier to GROWTH", () => {
    expect(resolveTrialPlan({ trialEndsAt: future(3), trialTier: null, now: NOW })).toBe("GROWTH");
    expect(resolveTrialPlan({ trialEndsAt: future(3), trialTier: "garbage", now: NOW })).toBe("GROWTH");
  });
});

describe("calculateBill — promo types", () => {
  const unit = 79000;

  it("FREE_MONTH grants `value` free months", () => {
    const calc = calculateBill(2, 3, { type: "FREE_MONTH", value: 1 } as any, unit);
    expect(calc.freeMonths).toBe(1);
    // gross 2×3×79k = 474k; charge 2 months → discount = 1 free month × 2 outlets
    expect(calc.discount).toBe(unit * 2 * 1);
    expect(calc.total).toBe(unit * 2 * 2);
  });

  it("DISCOUNT_PERCENT applies percent off gross", () => {
    const calc = calculateBill(1, 1, { type: "DISCOUNT_PERCENT", value: 50 } as any, unit);
    expect(calc.discount).toBe(Math.round((unit * 50) / 100));
    expect(calc.total).toBe(unit - calc.discount);
  });

  it("DISCOUNT_FIXED is capped at grossTotal", () => {
    const calc = calculateBill(1, 1, { type: "DISCOUNT_FIXED", value: 999999 } as any, unit);
    expect(calc.discount).toBe(unit); // capped, not 999999
    expect(calc.total).toBe(0);
  });
});
