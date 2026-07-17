"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/modules/shared";

const POLL_INTERVAL = 60_000; // 60 seconds

/**
 * Keeps the client-side session in sync with the server when permissions
 * or roles are changed by an admin.
 *
 * Polls /api/auth/session-version every 60 seconds (and on window focus).
 * If the server-side sessionVersion is higher than what's in the JWT,
 * triggers useSession().update() so the JWT callback reloads permissions.
 */
export function useSessionSync() {
  const { data: session, update } = useSession();
  const clientVersion = useRef<number | undefined>(session?.user?.sessionVersion);
  const polling = useRef(false);

  // Keep the ref updated
  useEffect(() => {
    clientVersion.current = (session?.user as any)?.sessionVersion;
  }, [session]);

  const checkVersion = async () => {
    if (polling.current) return;
    polling.current = true;
    try {
      const { data } = await apiFetch<{ sessionVersion?: number }>("/api/auth/session-version");
      const serverVersion = data.sessionVersion;
      if (serverVersion === undefined) return;

      const current = clientVersion.current ?? 0;
      if (serverVersion > current) {
        // Trigger JWT callback to reload permissions from DB
        await update({ refreshPermissions: true });
      }
    } catch {
      // Silently ignore — we'll retry on next interval / focus
    } finally {
      polling.current = false;
    }
  };

  useEffect(() => {
    const interval = setInterval(checkVersion, POLL_INTERVAL);
    const onFocus = () => checkVersion();
    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
