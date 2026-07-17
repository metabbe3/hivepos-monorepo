import { describe, it, expect } from "vitest";
import { EscPosBuilder } from "./escpos";

// Locks the ESC/POS code-page fix: init() must select the WPC1252 character
// code table (ESC t 16), and text must be latin1-encoded so Indonesian/Latin
// special chars render on single-byte thermal printers instead of garbling.
describe("EscPosBuilder — code page + latin1", () => {
  it("init() emits ESC @ then ESC t 16 (WPC1252)", () => {
    const buf = new EscPosBuilder().init().build();
    expect(Array.from(buf.slice(0, 5))).toEqual([0x1b, 0x40, 0x1b, 0x74, 0x10]);
  });

  it("text() latin1-encodes: ASCII bytes unchanged", () => {
    const buf = new EscPosBuilder().text("Rp 1.000").build();
    expect(Array.from(buf)).toEqual(Array.from(Buffer.from("Rp 1.000\n", "latin1")));
  });

  it("text() latin1-encodes: accented chars become a single byte (é → 0xe9)", () => {
    const buf = new EscPosBuilder().text("é").build();
    expect(Array.from(buf)).toEqual([0xe9, 0x0a]); // é + newline
  });
});
