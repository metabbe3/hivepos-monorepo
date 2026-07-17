"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";
import { BrandLogo } from "@/components/public/brand-logo";

const NAV_LINKS = [
  { href: "/#layanan", label: "Layanan" },
  { href: "/#lacak", label: "Lacak Pesanan" },
  { href: "/#lokasi", label: "Lokasi" },
];

export function PublicNavbar() {
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let lastY = 0;
    function onScroll() {
      const y = window.scrollY;
      setHidden(y > lastY && y > 80);
      setScrolled(y > 10);
      lastY = y;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${
        hidden ? "-translate-y-full" : "translate-y-0"
      } ${
        scrolled
          ? "bg-white/90 backdrop-blur-xl shadow-[0_1px_0_0_rgba(0,0,0,0.05)]"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className="group">
          <BrandLogo />
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="relative rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 group"
            >
              {link.label}
              <span className="absolute bottom-0 left-1/2 h-0.5 w-0 bg-brand transition-all duration-300 group-hover:left-4 group-hover:w-[calc(100%-2rem)] rounded-full" />
            </a>
          ))}
          <a
            href="#lacak"
            className="ml-4 inline-flex items-center rounded-full bg-gradient-to-r from-brand to-amber-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand/20 transition-all duration-300 hover:shadow-xl hover:shadow-brand/30 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            Lacak Pesanan
          </a>
        </div>

        {/* Mobile hamburger */}
        <div className="lg:hidden">
          <Sheet>
            <SheetTrigger
              render={
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-foreground hover:bg-slate-100 transition-colors"
                  aria-label="Buka menu navigasi"
                />
              }
            >
              <Menu className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] bg-white pt-14 px-6">
              <SheetHeader>
                <SheetTitle>
                  <BrandLogo size="sm" />
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 mt-6">
                {NAV_LINKS.map((link) => (
                  <SheetClose
                    key={link.href}
                    render={
                      <a
                        href={link.href}
                        className="rounded-xl px-4 py-3.5 text-sm font-medium text-foreground transition-all hover:bg-brand/5 hover:text-brand hover:pl-5"
                      />
                    }
                  >
                    {link.label}
                  </SheetClose>
                ))}
                <a
                  href="#estimasi"
                  className="mt-6 rounded-full bg-gradient-to-r from-brand to-brand-800 py-3.5 text-center text-sm font-bold text-white shadow-lg shadow-brand/25 transition-all hover:shadow-xl hover:-translate-y-0.5"
                >
                  Pesan via WhatsApp
                </a>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}
