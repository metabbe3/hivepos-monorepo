import type { MetadataRoute } from "next";

/**
 * Web App Manifest — makes hivePOS installable (Add to Home Screen).
 * Service worker registration lives in components/shared/pwa-register.tsx;
 * offline menu navigation is provided by public/sw.js caching the app shell
 * + runtime-caching RSC payloads + JS chunks.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "hivePOS — Kasir Laundry",
    short_name: "hivePOS",
    description:
      "Aplikasi kasir laundry ringan di browser untuk UMKM Indonesia.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#ffffff",
    theme_color: "#4f46e5",
    lang: "id",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
