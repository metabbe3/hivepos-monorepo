// Injects a build-unique VERSION into public/sw.js so each deploy busts the
// service-worker cache (hivepos-shell-v<VERSION> / hivepos-runtime-v<VERSION>).
// Without this, VERSION stays "dev" forever — the SW never invalidates its cache
// across deploys and serves stale JS chunks (old auth code, old page shells),
// which made redeployed fixes never reach the browser.
//
// Runs in prebuild (before `next build` copies public/ into the standalone output).
// Version = build-time epoch ms. Non-deterministic by design (cache-busting needs
// a value that changes every build, not a reproducible one).
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const swPath = resolve(here, "../public/sw.js");
const sw = readFileSync(swPath, "utf8");

const version = String(Date.now());
const next = sw.replace(/const VERSION = "[^"]*";/, `const VERSION = ${JSON.stringify(version)};`);

if (next === sw) {
  // The placeholder line changed shape — fail loud so a refactor doesn't silently
  // revert to the never-busting "dev" version.
  console.error("[gen-sw-version] could not find `const VERSION = \"...\";` in public/sw.js");
  process.exit(1);
}

writeFileSync(swPath, next);
console.log(`[gen-sw-version] sw.js VERSION=${version}`);
