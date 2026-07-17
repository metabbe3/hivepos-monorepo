"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { BrandMark } from "@/components/public/brand-logo";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";
import { SAAS_NAV_LINKS } from "@/lib/landing-data-saas";

/**
 * Solid sticky nav. No glassmorphism, no scroll listener (always bordered white),
 * one line at md+, 64px tall. Single accent (brand) on the wordmark + primary CTA.
 */
export function LandingNav() {
  const [activeSection, setActiveSection] = useState("");

  // Scroll-spy: highlight the nav link for the section currently in view.
  useEffect(() => {
    const ids = ["fitur", "modul", "harga", "faq"];
    const sections = ids
      .map((id) => document.getElementById(id))
      .filter(Boolean) as HTMLElement[];
    if (sections.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        });
      },
      { rootMargin: "-80px 0px -70% 0px" },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-6">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 font-display text-xl font-extrabold tracking-tight text-slate-900"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white">
            <BrandMark className="h-4 w-4" />
          </span>
          hive<span className="text-brand">POS</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-1 md:flex">
          {SAAS_NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={`rounded-md px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${
                link.href.startsWith("#") && activeSection === link.href.slice(1)
                  ? "text-slate-900"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* CTAs */}
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden rounded-md px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 sm:inline-block"
          >
            Masuk
          </Link>
          <Link
            href="/register"
            className="hidden rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 active:scale-[0.98] sm:inline-flex sm:items-center"
          >
            Mulai Gratis
          </Link>

          {/* Mobile menu */}
          <div className="md:hidden">
            <Sheet>
              <SheetTrigger
                render={
                  <button
                    type="button"
                    aria-label="Buka menu"
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  />
                }
              >
                <Menu className="h-5 w-5" />
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] bg-white pt-14 px-6">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2 font-display text-xl font-extrabold">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white">
                      <BrandMark className="h-4 w-4" />
                    </span>
                    hive<span className="text-brand">POS</span>
                  </SheetTitle>
                </SheetHeader>
                <nav className="mt-6 flex flex-col gap-1">
                  {SAAS_NAV_LINKS.map((link) => (
                    <SheetClose
                      key={link.href}
                      render={
                        <a
                          href={link.href}
                          className="rounded-lg px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                        />
                      }
                    >
                      {link.label}
                    </SheetClose>
                  ))}
                  <div className="mt-4 flex flex-col gap-2">
                    <Link
                      href="/login"
                      className="rounded-full border border-slate-300 py-2.5 text-center text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
                    >
                      Masuk
                    </Link>
                    <Link
                      href="/register"
                      className="rounded-full bg-brand py-2.5 text-center text-sm font-bold text-white transition-colors hover:bg-brand-700"
                    >
                      Mulai Gratis
                    </Link>
                  </div>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
}
