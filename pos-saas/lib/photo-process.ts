import sharp from "sharp";

// ponytail: WebP q70 @ longest-edge 1280 is the smallest-with-no-downside
// setting for laundry proof photos (typically 60–150 KB from a multi-MB phone
// shot). AVIF quality:55 is ~30% smaller but ~3x slower to encode per upload —
// not worth the CPU for a kasir snapping photos on a shared server. To swap,
// change MIME + .webp() → .avif({ quality: 55 }).
const MAX_EDGE = 1280;
const QUALITY = 70;

export interface CompressedPhoto {
  buffer: Buffer;
  width: number;
  height: number;
  mime: string;
}

/**
 * Normalize + compress an uploaded image to a small WebP. Rotates by EXIF
 * (phone photos arrive sideways), shrinks the longest edge to <=1280 without
 * upscaling small images, and encodes WebP at q70. Returns the bytes + dims.
 */
export async function compressPhoto(input: Buffer): Promise<CompressedPhoto> {
  const { data, info } = await sharp(input)
    .rotate()
    .resize({
      width: MAX_EDGE,
      height: MAX_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: QUALITY })
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: data,
    width: info.width,
    height: info.height,
    mime: "image/webp",
  };
}
