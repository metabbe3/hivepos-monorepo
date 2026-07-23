// Generates `public/sw.js` from `scripts/sw.template.js` with a build-unique
// VERSION so each deploy busts the service-worker cache
// (hivepos-shell-v<VERSION> / hivepos-runtime-v<VERSION>). Without this, VERSION
// stays constant — the SW never invalidates its cache across deploys and serves
// stale JS chunks (old auth code, old page shells), so redeployed fixes never
// reach the browser.
//
// Runs in prebuild (before `next build` copies public/ into the standalone output).
// Version = build-time epoch ms. Non-deterministic by design (cache-busting needs
// a value that changes every build, not a reproducible one).
//
// `public/sw.js` is gitignored — it is generated. Edit `scripts/sw.template.js`.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const templatePath = resolve(here, "./sw.template.js");
const swPath = resolve(here, "../public/sw.js");

const template = readFileSync(templatePath, "utf8");

const version = String(Date.now());
const out = template.replace(/const VERSION = "\{\{VERSION\}\}";/, `const VERSION = ${JSON.stringify(version)};`);

if (out === template) {
  // The template's placeholder line changed shape — fail loud so a refactor
  // doesn't silently ship a never-busting SW.
  console.error("[gen-sw-version] could not find `const VERSION = \"{{VERSION}}\";` in scripts/sw.template.js");
  process.exit(1);
}

mkdirSync(dirname(swPath), { recursive: true });
writeFileSync(swPath, out);
console.log(`[gen-sw-version] public/sw.js VERSION=${version}`);
