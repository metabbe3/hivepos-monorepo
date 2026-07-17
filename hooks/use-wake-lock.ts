"use client";

import { useEffect, useState } from "react";

// ponytail: Screen Wake Lock API — Chromium/Android only at write time.
// Safari 16.4+ has it behind the flag; iOS Safari still unsupported.
// Silent fallback (noop) when navigator.wakeLock is undefined — the toggle
// still flips but does nothing. Upgrade path: none, this is the API.
const STORAGE_KEY = "hivepos.wakeLock";

type WakeLockSentinel = {
  release: () => Promise<void>;
  addEventListener: (type: "release", cb: () => void) => void;
};

export function useWakeLock() {
  const [enabled, setEnabled] = useState(false);
  const [supported, setSupported] = useState(true);

  // Hydrate from localStorage on mount.
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    if (!("wakeLock" in navigator)) {
      setSupported(false);
      return;
    }
    const stored = localStorage.getItem(STORAGE_KEY) === "on";
    setEnabled(stored);
  }, []);

  // Acquire/release sentinel whenever `enabled` flips.
  // Re-acquire on visibilitychange (wake lock auto-releases when tab hidden).
  useEffect(() => {
    if (!enabled || !("wakeLock" in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;

    const acquire = async () => {
      try {
        sentinel = await navigator.wakeLock.request("screen");
        sentinel?.addEventListener("release", () => {
          sentinel = null;
        });
      } catch {
        // User denied, or page not focused — non-fatal.
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible" && enabled) acquire();
    };

    acquire();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if (sentinel) sentinel.release().catch(() => {});
    };
  }, [enabled]);

  function toggle(next?: boolean) {
    const value = next ?? !enabled;
    setEnabled(value);
    try {
      localStorage.setItem(STORAGE_KEY, value ? "on" : "off");
    } catch {
      // Storage unavailable (private mode) — session-only is fine.
    }
  }

  return { enabled, supported, toggle };
}
