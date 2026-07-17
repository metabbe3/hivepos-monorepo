/**
 * Pick the newest "before" and newest "after" photo for the before/after
 * comparison slider. Pure + unit-tested (no prisma). Shared by the dashboard
 * photo section and the customer tracking page.
 *
 * `createdAt` is an ISO string, so a lexicographic compare orders by time.
 */
export interface PhotoLite {
  id: string;
  kind: string;
  createdAt: string;
}

export function pickBeforeAfterPair<T extends PhotoLite>(
  photos: T[],
): { before?: T; after?: T } {
  let before: T | undefined;
  let after: T | undefined;
  for (const p of photos) {
    if (p.kind === "before" && (!before || p.createdAt > before.createdAt)) {
      before = p;
    } else if (
      p.kind === "after" &&
      (!after || p.createdAt > after.createdAt)
    ) {
      after = p;
    }
  }
  return { before, after };
}
