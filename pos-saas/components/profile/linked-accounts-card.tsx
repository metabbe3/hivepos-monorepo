"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Link2, Loader2, Unlink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTranslation } from "@/hooks/use-translation";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { apiFetch, ApiClientError } from "@/modules/shared";

interface LinkedAccountsCardProps {
  googleId: string | null;
  avatar?: string | null;
  email?: string | null;
  /** Called after unlink to refresh the profile payload. */
  onChanged: (next: { googleId: null }) => void;
}

export function LinkedAccountsCard({
  googleId,
  avatar,
  email,
  onChanged,
}: LinkedAccountsCardProps) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const linked = !!googleId;

  async function handleLink() {
    setLinking(true);
    try {
      await apiFetch("/api/user/profile/oauth-link/start", { method: "POST" });
      // Browser navigates to Google, back to /profile?linked=google
      await signIn("google", { callbackUrl: "/profile?linked=google" });
    } catch (err) {
      setLinking(false);
      toast.error(
        err instanceof ApiClientError
          ? err.message
          : t("profile.googleLinkFailed"),
      );
    }
  }

  async function handleUnlink() {
    if (!(await confirm({
      title: t("profile.unlinkTitle"),
      description: t("profile.unlinkConfirm"),
      destructive: true,
    }))) return;
    setUnlinking(true);
    try {
      await apiFetch("/api/user/profile/oauth-link", { method: "DELETE" });
      toast.success(t("profile.googleUnlinked"));
      onChanged({ googleId: null });
    } catch (err) {
      toast.error(
        err instanceof ApiClientError
          ? err.message
          : t("profile.googleUnlinkFailed"),
      );
    } finally {
      setUnlinking(false);
    }
  }

  return (
    <Card className="overflow-hidden rounded-xl border-border/60 shadow-sm">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center gap-2 border-b border-border/40 pb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Link2 className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide">
              {t("profile.linkedAccounts")}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {t("profile.linkedAccountsDesc")}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            {/* Google "G" mark — inline SVG so we don't add a dep just for one icon */}
            <GoogleMark className="h-7 w-7 shrink-0" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {t("profile.google")}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {linked ? (email ?? t("profile.googleLinked")) : t("profile.googleNotLinked")}
              </p>
            </div>
            {avatar && linked ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatar}
                alt=""
                className="h-6 w-6 shrink-0 rounded-full object-cover"
              />
            ) : null}
          </div>

          {linked ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleUnlink}
              disabled={unlinking}
              className="gap-1.5"
            >
              {unlinking ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Unlink className="h-3.5 w-3.5" />
              )}
              {unlinking ? t("profile.unlinking") : t("profile.unlinkGoogle")}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleLink}
              disabled={linking}
              className={cn(
                "gap-1.5 bg-gradient-to-r from-brand-600 to-brand-700 shadow-md shadow-brand-600/15 transition-all hover:brightness-105 hover:shadow-lg",
              )}
            >
              {linking ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              {linking ? t("profile.linking") : t("profile.linkGoogle")}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}
