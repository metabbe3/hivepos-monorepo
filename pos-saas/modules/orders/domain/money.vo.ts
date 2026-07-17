/**
 * Money value object.
 *
 * Wraps a monetary amount and enforces non-negativity. For Indonesian Rupiah
 * (no sub-unit) JS `number` is safe up to 2^53, far beyond any realistic total.
 *
 * Arithmetic returns a new Money instance rather than mutating, so values can
 * be passed around safely.
 */
export class Money {
  private readonly _amount: number;

  constructor(amount: number) {
    if (typeof amount !== "number" || !Number.isFinite(amount)) {
      throw new Error(`Money requires a finite number, got: ${amount}`);
    }
    // Round to 2 decimal places to avoid float drift from calculations.
    this._amount = Math.round((amount + Number.EPSILON) * 100) / 100;
  }

  static zero(): Money {
    return new Money(0);
  }

  static from(value: Money | number): Money {
    return value instanceof Money ? value : new Money(value);
  }

  get amount(): number {
    return this._amount;
  }

  add(other: Money | number): Money {
    return new Money(this._amount + Money.from(other).amount);
  }

  subtract(other: Money | number): Money {
    return new Money(this._amount - Money.from(other).amount);
  }

  multiply(factor: number): Money {
    return new Money(this._amount * factor);
  }

  /** Percentage of this amount (0–100). e.g. money.percent(10) = 10%. */
  percent(pct: number): Money {
    return new Money((this._amount * pct) / 100);
  }

  isNegative(): boolean {
    return this._amount < 0;
  }

  isZero(): boolean {
    return this._amount === 0;
  }

  isGreaterThan(other: Money | number): boolean {
    return this._amount > Money.from(other).amount;
  }

  isLessThan(other: Money | number): boolean {
    return this._amount < Money.from(other).amount;
  }

  isGreaterThanOrEqual(other: Money | number): boolean {
    return this._amount >= Money.from(other).amount;
  }

  equals(other: Money | number): boolean {
    return this._amount === Money.from(other).amount;
  }

  /** Cap this amount at `cap` (e.g. fixed discount can't exceed subtotal). */
  min(cap: Money | number): Money {
    const capAmount = Money.from(cap).amount;
    return new Money(Math.min(this._amount, capAmount));
  }

  toString(): string {
    return this._amount.toFixed(2);
  }
}
