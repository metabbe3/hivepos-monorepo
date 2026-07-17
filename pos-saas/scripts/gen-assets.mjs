// ponytail: one-shot asset generator. Run after changing brand visuals.
// Produces: og-image.png (1200×630), apple-touch-icon.png (180×180), favicon.ico (32×32 + 16×16).
// Uses sharp (already in node_modules via Next.js). No ImageMagick dependency.
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { writeFileSync } from "node:fs";

const ICON = readFileSync(new URL("../public/icon.svg", import.meta.url));

// 1. apple-touch-icon.png — 180×180, pad with teal background so iOS rounded mask looks right
const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0E7C7B"/>
      <stop offset="100%" stop-color="#0a5d5c"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <!-- decorative circles, top right -->
  <circle cx="1080" cy="120" r="180" fill="#FF6B5E" opacity="0.18"/>
  <circle cx="1150" cy="80" r="80" fill="#FF6B5E" opacity="0.35"/>
  <!-- brand mark -->
  <g transform="translate(100, 180)">
    <rect width="84" height="84" rx="18" fill="#fff"/>
    <path d="M26 21h8v17h16V21h8v42h-8V45H34v18h-8V21z" fill="#0E7C7B"/>
    <circle cx="63" cy="21" r="6.5" fill="#FF6B5E"/>
  </g>
  <text x="200" y="240" font-family="Manrope, Inter, system-ui, sans-serif" font-size="44" font-weight="800" fill="#fff" opacity="0.85">hivePOS</text>
  <!-- headline -->
  <text x="100" y="370" font-family="Manrope, Inter, system-ui, sans-serif" font-size="76" font-weight="800" fill="#fff">Aplikasi Kasir Laundry</text>
  <text x="100" y="455" font-family="Manrope, Inter, system-ui, sans-serif" font-size="76" font-weight="800" fill="#FF6B5E">Rp 49K / outlet</text>
  <!-- subheadline -->
  <text x="100" y="520" font-family="Inter, system-ui, sans-serif" font-size="28" fill="#fff" opacity="0.75">Multi-outlet. Dashboard real-time. Thermal printer. Gratis 1 outlet.</text>
</svg>`;

await sharp(Buffer.from(ogSvg)).png().toFile("public/og-image.png");

await sharp(ICON, { density: 384 })
  .resize(180, 180)
  .png()
  .toFile("public/apple-touch-icon.png");

// favicon.ico — ICO with PNG payload (6-byte ICONDIR + 16-byte ICONDIRENTRY + PNG bytes).
// Supported by all modern browsers. ponytail: sharp can't emit .ico directly, so hand-roll the header.
await sharp(ICON, { density: 384 })
  .resize(32, 32)
  .png()
  .toFile("public/favicon-32.png");

const pngBytes = readFileSync("public/favicon-32.png");
const icoHeader = Buffer.from([0, 0, 1, 0, 1, 0]); // type=icon, count=1
const icoEntry = Buffer.alloc(16);
icoEntry.writeUInt8(32, 0); // width
icoEntry.writeUInt8(32, 1); // height
icoEntry.writeUInt8(0, 2);  // palette
icoEntry.writeUInt8(0, 3);  // reserved
icoEntry.writeUInt16LE(1, 4);  // color planes
icoEntry.writeUInt16LE(32, 6); // bpp
icoEntry.writeUInt32LE(pngBytes.length, 8);
icoEntry.writeUInt32LE(6 + 16, 12); // offset
writeFileSync("public/favicon.ico", Buffer.concat([icoHeader, icoEntry, pngBytes]));

console.log("Generated: og-image.png, apple-touch-icon.png, favicon-32.png, favicon.ico");
