import { describe, it, expect } from "vitest";
import { pickBeforeAfterPair } from "./photo-pair";

const photo = (id: string, kind: string, createdAt: string) => ({
  id,
  kind,
  createdAt,
});

describe("pickBeforeAfterPair", () => {
  it("returns the newest before + newest after, ignoring damage", () => {
    const pair = pickBeforeAfterPair([
      photo("dmg", "damage", "2026-06-25T10:00:00Z"),
      photo("b1", "before", "2026-06-25T09:00:00Z"),
      photo("a1", "after", "2026-06-25T11:00:00Z"),
      photo("b2", "before", "2026-06-25T09:30:00Z"), // newer before
      photo("a2", "after", "2026-06-25T10:30:00Z"), // older after
    ]);
    expect(pair.before?.id).toBe("b2");
    expect(pair.after?.id).toBe("a1");
  });

  it("returns undefined for a missing side", () => {
    const pair = pickBeforeAfterPair([photo("b1", "before", "2026-06-25T09:00:00Z")]);
    expect(pair.before?.id).toBe("b1");
    expect(pair.after).toBeUndefined();
  });

  it("returns both undefined for an empty list", () => {
    const pair = pickBeforeAfterPair([]);
    expect(pair.before).toBeUndefined();
    expect(pair.after).toBeUndefined();
  });

  it("preserves the full photo object (generic T)", () => {
    const photos = [
      { id: "b1", kind: "before", createdAt: "2026-06-25T09:00:00Z", bytes: 1234 },
    ];
    const pair = pickBeforeAfterPair(photos);
    expect(pair.before?.bytes).toBe(1234);
  });
});
