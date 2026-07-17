"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";

// Sticky "Mode Demo" banner shown only for sandbox demo sessions. Makes clear
// the data is sample/throwaway + funnels to real signup. See lib/demo/sandbox.ts.
export function DemoBanner() {
  const { data: session } = useSession();
  const { t } = useTranslation();
  if (!session?.user?.isDemo) return null;

  return (
    <div className="flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-700 px-4 py-2 text-center text-xs font-medium text-white shadow-sm sm:text-sm">
      <Sparkles className="h-3.5 w-3.5 shrink-0" />
      <span>{t("demo.banner")}</span>
      <Link
        href="/register"
        className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 font-semibold transition-colors hover:bg-white/30"
      >
        {t("demo.cta")}
        <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
