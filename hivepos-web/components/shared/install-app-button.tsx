"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/use-translation";

// ponytail: BeforeInstallPromptEvent is Chromium-only — no lib.dom typing.
// Minimal local type covers what we use; cast elsewhere. Upgrade path:
// use `web-util-types` or wait for TS DOM lib to include it.
type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "hivepos.install.dismissed";

/**
 * Install App button for the tenant dashboard header.
 *
 * Two platform paths (Apple blocks `beforeinstallprompt` on iOS):
 * - Chromium (Chrome/Edge/Android): intercept `beforeinstallprompt`, call
 *   `prompt()` on click → native install dialog.
 * - iOS/iPad Safari: show the button; click shows a toast with the manual
 *   "Share → Add to Home Screen" instruction (the only path on iOS).
 *
 * Hidden when:
 * - Already running as standalone PWA (`display-mode: standalone` or
 *   iOS Safari's `navigator.standalone`)
 * - User previously dismissed (persisted to localStorage so it doesn't nag)
 * - Desktop Safari / Firefox (no `beforeinstallprompt`, no iOS detection) —
 *   falls back to the browser's native install entry in the URL bar / menu.
 */
export function InstallAppButton() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"chromium" | "ios">("chromium");
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Already installed → hide permanently
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    if ((navigator as { standalone?: boolean }).standalone === true) return; // iOS Safari

    // 2. Previously dismissed → respect until user clears storage
    if (localStorage.getItem(DISMISS_KEY)) return;

    // 3. iOS/iPadOS — no beforeinstallprompt; show button with instructions path
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (isIOS) {
      setMode("ios");
      setShow(true);
      return;
    }

    // 4. Chromium — wait for the browser to offer installability
    const onBefore = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setMode("chromium");
      setShow(true);
    };
    const onInstalled = () => {
      setDeferred(null);
      setShow(false);
    };
    window.addEventListener("beforeinstallprompt", onBefore);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBefore);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!show) return null;

  const onClick = async () => {
    if (mode === "chromium" && deferred) {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === "dismissed") localStorage.setItem(DISMISS_KEY, "1");
      // accepted path: appinstalled handler hides; dismiss path: hide now
      setDeferred(null);
      setShow(false);
    } else if (mode === "ios") {
      toast(t("install.iosInstructions"), { duration: 10000 });
      localStorage.setItem(DISMISS_KEY, "1");
      setShow(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      aria-label={t("install.installApp")}
      title={t("install.installApp")}
      className="h-8 w-8 rounded-lg text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
    >
      <Download className="h-4 w-4" />
    </Button>
  );
}
