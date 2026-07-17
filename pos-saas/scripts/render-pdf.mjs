// Render an HTML slide deck to PDF, one slide per page (1280×720).
// Usage: node scripts/render-pdf.mjs <input.html> <output.pdf>
import { chromium } from "playwright";
import { pathToFileURL } from "url";

const [html, pdf] = process.argv.slice(2);
if (!html || !pdf) {
  console.error("Usage: node scripts/render-pdf.mjs <input.html> <output.pdf>");
  process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(pathToFileURL(html).href, { waitUntil: "networkidle" });
await page.pdf({
  path: pdf,
  width: "1280px",
  height: "720px",
  printBackground: true,
  margin: { top: "0", right: "0", bottom: "0", left: "0" },
});
await browser.close();
console.log(`✓ ${pdf}`);
