import { describe, it, expect } from "vitest";
import {
  BCRYPT_ROUNDS,
  hashPassword,
  verifyPassword,
} from "./password";

describe("BCRYPT_ROUNDS", () => {
  it("is 12 (the project's standard cost factor)", () => {
    expect(BCRYPT_ROUNDS).toBe(12);
  });
});

describe("hashPassword", () => {
  it("returns a bcrypt-style hash distinguishable from the input", async () => {
    const hash = await hashPassword("hunter2");
    expect(hash).not.toBe("hunter2");
    expect(hash.startsWith("$2")).toBe(true);
  });

  it("produces a different hash each call (bcrypt salting)", async () => {
    const a = await hashPassword("same-password");
    const b = await hashPassword("same-password");
    expect(a).not.toBe(b);
  });
});

describe("verifyPassword", () => {
  it("returns true for a matching plaintext/hash pair", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
  });

  it("returns false for a wrong plaintext", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });

  it("returns false for an empty plaintext against a real hash", async () => {
    const hash = await hashPassword("nonempty");
    expect(await verifyPassword("", hash)).toBe(false);
  });
});
