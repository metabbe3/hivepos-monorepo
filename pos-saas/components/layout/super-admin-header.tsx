"use client";

import { signOut, useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut, Shield, ChevronRight } from "lucide-react";
import { ThemeToggle } from "@/components/shared/theme-toggle";

// ponytail: section + page-title lookup. Returns a "Section / Page" breadcrumb.
const SECTIONS: { match: string; section: string; title: string }[] = [
  { match: "/super-admin/performance", section: "Monitor", title: "Performance" },
  { match: "/super-admin/health", section: "Monitor", title: "System Health" },
  { match: "/super-admin/pickup-insights", section: "Monitor", title: "Pickup Insights" },
  { match: "/super-admin/tenants", section: "Customers", title: "Tenants" },
  { match: "/super-admin/plans", section: "Customers", title: "Plans" },
  { match: "/super-admin/promo-codes", section: "Customers", title: "Promo Codes" },
  { match: "/super-admin/billing", section: "Customers", title: "Billing" },
  { match: "/super-admin/users", section: "Customers", title: "Users" },
  { match: "/super-admin/tickets", section: "Operations", title: "Tickets" },
  { match: "/super-admin/error-logs", section: "Operations", title: "Error Logs" },
  { match: "/super-admin/audit-log", section: "Operations", title: "Audit Log" },
  { match: "/super-admin/admins", section: "Operations", title: "Admins" },
  { match: "/super-admin/feature-flags", section: "Operations", title: "Feature Flags" },
  { match: "/super-admin/settings", section: "Operations", title: "Settings" },
];

export function SuperAdminHeader() {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  let section = "";
  let title = "";
  if (pathname === "/super-admin") {
    section = "Monitor";
    title = "Overview";
  } else {
    const found = SECTIONS.filter((s) => pathname.startsWith(s.match)).sort(
      (a, b) => b.match.length - a.match.length,
    )[0];
    if (found) {
      section = found.section;
      title = found.title;
    }
  }

  const role = (session?.user as any)?.role;

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push("/super-admin/login");
  };

  return (
    // ponytail: soft border-bottom, matches tenant header.
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 sm:gap-3 border-b border-border bg-background px-3 sm:px-5">
      <SidebarTrigger className="h-8 w-8 rounded-lg transition-colors hover:bg-muted/60 [&>svg]:h-4 [&>svg]:w-4" />
      <Separator orientation="vertical" className="hidden h-5 bg-border sm:block" />

      {/* Breadcrumb */}
      <nav className="hidden items-center gap-1.5 text-sm sm:flex">
        {section && (
          <span className="text-xs text-muted-foreground">{section}</span>
        )}
        {section && title && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
        {title && <span className="text-sm font-medium">{title}</span>}
      </nav>

      <div className="flex-1" />

      <ThemeToggle />

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className="h-9 gap-2 rounded-lg px-2 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            />
          }
        >
          {/* ponytail: tinted avatar tile. */}
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Shield className="h-3.5 w-3.5" />
          </div>
          <span className="hidden text-sm font-medium sm:inline">
            {session?.user?.name ?? "Admin"}
          </span>
          <Badge variant="secondary" className="hidden sm:inline-flex">
            {role === "SUPER_ADMIN" ? "Super Admin" : "Support"}
          </Badge>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
