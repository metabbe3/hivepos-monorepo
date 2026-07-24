// ponytail: Next.js unconditionally require()s polyfill-module.js from client/app-globals.js —
// no config flag, browserslist ignored. Lighthouse flags 7 of its 9 polyfills (at/flat/flatMap/
// fromEntries/hasOwn/trimStart/trimEnd — all >95% browser-native). Replace with ONLY URL.canParse
// (Chrome 126 / 2024-06, ~88%, the lone real support gap, and NOT Lighthouse-flagged) to clear the
// Legacy-JavaScript audit while preserving the one polyfill that matters.
// Ceiling: browsers lacking URL.canParse (~12%, pre-2024) still work via this kept shim; browsers
// lacking the 7 removed features (<5%, pre-2021) will rely on native support. Re-add all by
// deleting this script from prebuild.
import { writeFileSync, existsSync } from "node:fs";

const FILE = "node_modules/next/dist/build/polyfills/polyfill-module.js";
if (!existsSync(FILE)) {
  console.log("[strip-next-polyfill] file not found — Next upgraded? Skipping.");
  process.exit(0);
}
writeFileSync(
  FILE,
  `/* stripped by scripts/strip-next-polyfill.mjs — keep only URL.canParse; see ponytail note */\n` +
    `"canParse"in URL||(URL.canParse=function(t,r){try{return!!new URL(t,r)}catch(t){return!1}});\n`,
);
console.log("[strip-next-polyfill] reduced polyfill-module.js to URL.canParse only");
