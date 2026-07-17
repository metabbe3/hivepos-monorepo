"use client";

import { useEffect } from "react";

// ponytail: client-side polling instead of SW-side nonce check on every nav.
// Rationale: nonce rotation is rare (per hotfix). SW check on every nav would
// add a network roundtrip to every page load for zero benefit when unchanged.
// 10-min poll + on-focus covers it with minutes of acceptable delay. SW stays
// dumb — client owns the nuke + unregister + reload sequence.
//
// Ceiling: up to 10 min delay between nonce rotation and client reload. If
// realtime is ever needed, add a `postMessage` from SW → client on
// `updatefound`. Upgrade path: WebSocket / SSE broadcast from admin action.

const STORAGE_KEY = "hivepos.pwaNonce";
const POLL_MS = 3 * 60 * 1000; // 3 min
const NONCE_URL = "/api/pwa/nonce";

async function checkAndMaybeNuke() {
  try {
    const res = await fetch(NONCE_URL, { cache: "no-store" });
    if (!res.ok) return;
    const json = (await res.json()) as { success?: boolean; data?: { nonce?: string } };
    const serverNonce = json?.data?.nonce ?? "";
    const storedNonce = localStorage.getItem(STORAGE_KEY);

    // First-ever visit: seed stored, no nuke.
    if (storedNonce === null) {
      localStorage.setItem(STORAGE_KEY, serverNonce);
      return;
    }
    // Match → nothing to do.
    if (storedNonce === serverNonce) return;

    // Mismatch → nuke caches + unregister SW + reload.
    // ponytail: client can do all of this directly; no SW message needed.
    const cacheKeys = await caches.keys();
    await Promise.all(cacheKeys.map((k) => caches.delete(k)));
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    localStorage.setItem(STORAGE_KEY, serverNonce);
    location.reload();
  } catch {
    // Offline / 5xx — next poll will retry.
  }
}

export function PwaForceUpdateWatcher() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined") return;

    checkAndMaybeNuke();

    const interval = window.setInterval(checkAndMaybeNuke, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") checkAndMaybeNuke();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
