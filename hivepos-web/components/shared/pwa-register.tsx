"use client";

import { useEffect } from "react";

/**
 * Registers /sw.js in production only. Dev mode (Turbopack HMR) fights SW
 * caching — registering there serves stale chunks and breaks hot reload.
 * Errors are swallowed: the SW is a progressive enhancement, never required
 * for the app to function.
 */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // SW registration failed — app still works online, just not installable/offline-shell.
      });
    };
    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
    }
  }, []);

  return null;
}
