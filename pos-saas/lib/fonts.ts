import { Inter, Manrope, Plus_Jakarta_Sans } from "next/font/google";

/**
 * Font configuration for hivePOS.
 *
 * - Inter: body text everywhere (legibility, Indonesian diacritics)
 * - Manrope: SaaS platform display headings (geometric, editorial)
 * - Plus Jakarta Sans: storefront display headings (Indonesian-designed, local personality)
 *
 * Each font maps to a CSS variable consumed by the `@theme` block in
 * `app/globals.css` (`--font-sans`, `--font-display`, `--font-serif`).
 */
export const fontSans = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const fontDisplay = Manrope({
  subsets: ["latin"],
  display: "swap",
  // ponytail: 4 weights → 2. Hero/headings only use 700/800; lighter weights
  // fall back to Inter via the --font-sans stack. Re-add 400/600 if a display
  // weight below 700 is needed.
  weight: ["700", "800"],
  variable: "--font-manrope",
});

export const fontSerif = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "600", "700", "800"],
  variable: "--font-jakarta",
});
