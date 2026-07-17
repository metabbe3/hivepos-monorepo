import { describe, it, expect } from "vitest";
import { randomFillSync } from "node:crypto";
import sharp from "sharp";
import { compressPhoto } from "./photo-process";

// Solid-color PNG of arbitrary size — stands in for an oversized phone upload
// without a binary fixture checked into the repo.
async function rawPng(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 100, b: 50 } },
  })
    .png()
    .toBuffer();
}

// High-entropy (random-noise) PNG — PNG can't compress noise, so this is a
// genuinely large source and the worst case for the compressor.
async function noisyPng(width: number, height: number): Promise<Buffer> {
  const raw = Buffer.alloc(width * height * 3);
  randomFillSync(raw);
  return sharp(raw, { raw: { width, height, channels: 3 } }).png().toBuffer();
}

describe("compressPhoto", () => {
  it("shrinks an oversized image to ≤1280px longest edge and outputs webp", async () => {
    const raw = await rawPng(4000, 3000); // 12MP "phone" photo
    const out = await compressPhoto(raw);

    expect(out.mime).toBe("image/webp");
    expect(Math.max(out.width, out.height)).toBeLessThanOrEqual(1280);
    expect(out.buffer.length).toBeLessThan(raw.length);
    // A flat-color 1280px WebP @ q70 is tiny — well under the 150KB target.
    expect(out.buffer.length).toBeLessThan(150_000);
  });

  it("drastically compresses a high-entropy image (worst case for compression)", async () => {
    const raw = await noisyPng(720, 480);
    // Sanity: the raw PNG really is large (noise is incompressible).
    expect(raw.length).toBeGreaterThan(500_000);

    const out = await compressPhoto(raw);
    expect(out.mime).toBe("image/webp");
    expect(Math.max(out.width, out.height)).toBeLessThanOrEqual(1280);
    // WebP q70 still cuts the incompressible source to a small fraction — the
    // honest proof that the pipeline compresses, not just resizes.
    expect(out.buffer.length).toBeLessThan(raw.length / 3);
    expect(out.buffer.length).toBeLessThan(300_000);
  });

  it("does not upscale a small image", async () => {
    const out = await compressPhoto(await rawPng(200, 200));
    expect(out.width).toBe(200);
    expect(out.height).toBe(200);
  });

  it("caps the longest edge at 1280 for a tall image (portrait)", async () => {
    const out = await compressPhoto(await rawPng(1000, 5000));
    expect(out.height).toBeLessThanOrEqual(1280);
    expect(out.width).toBeLessThanOrEqual(1280);
  });

  it("rejects a corrupt / non-image buffer (the POST route catches this → 400)", async () => {
    await expect(compressPhoto(Buffer.from("not an image"))).rejects.toThrow();
  });
});
