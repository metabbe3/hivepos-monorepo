// Ambient declaration for plain CSS side-effect imports (e.g. `import "./globals.css"`).
// Next's bundled types cover typed `*.module.css`, but not side-effect `.css`
// imports — so standalone `tsc --noEmit` (the QA gate) needs this. `*.module.css`
// stays more specific and still wins for CSS modules.
declare module "*.css";
