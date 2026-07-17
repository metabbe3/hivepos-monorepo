// One-off: generate PWA icons from the brand mark.
// Run: node scripts/gen-icons.mjs  (commits the PNGs to public/icons/)
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const SRC = join(root, "public/brand/mark-transparent-4k.png");
const OUT = join(root, "public/icons");

const BRAND_BG = "#4f46e5"; // indigo-600 — matches manifest theme_color

async function main() {
  const buf = await readFile(SRC);

  // Standard icons — mark on transparent bg, sized exactly.
  await sharp(buf).resize(192, 192, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(join(OUT, "icon-192.png"));
  await sharp(buf).resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(join(OUT, "icon-512.png"));

  // Maskable — full-bleed brand bg with the mark centered in the safe zone (~80%).
  // ponytail: composite approach — colored canvas + resized mark on top.
  const mark512 = await sharp(buf).resize(384, 384, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  await sharp({
    create: { width: 512, height: 512, channels: 4, background: BRAND_BG },
  })
    .composite([{ input: mark512, gravity: "center" }])
    .png()
    .toFile(join(OUT, "maskable-512.png"));

  console.log("✓ Generated icon-192.png, icon-512.png, maskable-512.png");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
