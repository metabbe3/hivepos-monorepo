/**
 * Transient-failure retry for apiFetch.
 *
 * Retries ONLY on transient failures (network errors, 429, 5xx). Never on 4xx —
 * 4xx is user-actionable (validation/auth), retrying won't fix it. Matches the
 * rule proven in lib/offline/sync-engine.ts:postWithRetry + lessons-learned #11.
 *
 * ponytail: this is the shared helper; apiFetch wraps its single attempt in a
 * closure and lets withRetry drive the loop. No new deps.
 */

export interface RetryOptions {
  /** total attempts including the first. default 3 */
  attempts?: number;
  /** backoff base in ms. default 1000. set 0 in tests for instant retries */
  baseMs?: number;
  /** per-attempt abort timeout in ms. 0 (default) = no FE timeout. */
  timeoutMs?: number;
}

/** Error is worth retrying: network blip / abort / 429 / 5xx. Never 4xx. */
export function isTransientError(err: unknown): boolean {
  if (err instanceof Error) {
    // fetch() throws TypeError on network failure; AbortSignal.timeout aborts
    // surface as AbortError/TimeoutError. All transient.
    if (err.name === "TypeError" || err.name === "AbortError" || err.name === "TimeoutError") {
      return true;
    }
  }
  // ApiClientError carries httpStatus — duck-typed so we don't import client.ts
  // (avoids a circular dep: client imports this).
  const status = (err as { httpStatus?: number })?.httpStatus;
  if (typeof status === "number") {
    return status === 429 || status >= 500;
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  // ponytail: skip the timer entirely when ms<=0 (tests pass baseMs:0)
  if (ms <= 0) return Promise.resolve();
  return new Promise((r) => setTimeout(r, ms));
}

function makeSignal(timeoutMs: number): AbortSignal | undefined {
  // timeoutMs=0 (apiFetch default) → no FE timeout; BE already enforces 15/60s.
  return timeoutMs > 0 ? AbortSignal.timeout(timeoutMs) : undefined;
}

/**
 * Run `attempt` up to `attempts` times. Retries when `shouldRetry(err)` is true.
 * Backoff: baseMs * 2^(i-1), plus up to +baseMs full jitter (anti-thundering-herd
 * when many clients recover against the same backend).
 */
export async function withRetry<T>(
  attempt: (signal: AbortSignal | undefined) => Promise<T>,
  shouldRetry: (err: unknown) => boolean,
  opts: RetryOptions = {},
): Promise<T> {
  const attempts = opts.attempts ?? 3;
  const baseMs = opts.baseMs ?? 1000;
  const timeoutMs = opts.timeoutMs ?? 0;

  let lastErr: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await attempt(makeSignal(timeoutMs));
    } catch (err) {
      lastErr = err;
      if (i === attempts || !shouldRetry(err)) throw err;
      const delay = baseMs * Math.pow(2, i - 1) + Math.random() * baseMs;
      await sleep(delay);
    }
  }
  throw lastErr; // unreachable — loop throws on last attempt
}
