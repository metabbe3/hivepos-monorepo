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
import { LogOut, User, UserCircle, LifeBuoy } from "lucide-react";
import { useRole } from "@/hooks/use-role";
import { useTranslation } from "@/hooks/use-translation";
import { BranchSelector } from "@/components/shared/branch-selector";
import { TicketBell } from "@/components/tickets/ticket-bell";
import { InstallAppButton } from "@/components/shared/install-app-button";

// ponytail: route → i18n key. Values resolved via t() so titles follow the
// active locale. New routes: add an entry here + the i18n key in lib/i18n.ts.
const ROUTE_TITLE_KEYS: Record<string, string> = {
  "/dashboard": "nav.dashboard",
  "/laundry/orders": "nav.orders",
  "/laundry/pickup-requests": "nav.pickup",
  "/laundry/services": "nav.services",
  "/laundry/inventory": "nav.inventory",
  "/laundry/expenses": "nav.expenses",
  "/customers": "nav.customers",
  "/reporting": "nav.reporting",
  "/branches": "nav.branches",
  "/users": "nav.users",
  "/roles": "nav.roles",
  "/billing": "nav.billing",
  "/website": "nav.website",
  "/whatsapp-templates": "nav.whatsappTemplates",
  "/printer-settings": "nav.printerSettings",
  "/tickets": "nav.help",
  "/profile": "profile.title",
};

export function Header() {
  const { data: session } = useSession();
  const { isOwner } = useRole();
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();

  // Longest-prefix match so /laundry/orders/123 still resolves to "Orders".
  const titleKey =
    Object.entries(ROUTE_TITLE_KEYS)
      .filter(([href]) => pathname.startsWith(href))
      .sort((a, b) => b[0].length - a[0].length)[0]?.[1];
  const currentTitle = titleKey ? t(titleKey) : "";

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push("/login");
  };

  return (
    <header className="flex h-13 items-center gap-1.5 sm:gap-3 border-b border-border/60 bg-background/80 px-3 sm:px-4 backdrop-blur-sm">
      <SidebarTrigger className="h-8 w-8 rounded-lg transition-colors hover:bg-accent/60 [&>svg]:h-4 [&>svg]:w-4" />
      <Separator orientation="vertical" className="hidden h-5 bg-border/60 sm:block" />
      {currentTitle && (
        <span className="text-sm font-medium text-muted-foreground hidden sm:inline">
          {currentTitle}
        </span>
      )}
      <div className="flex-1" />
      <div className="hidden sm:block"><BranchSelector /></div>
      <TicketBell />
      <InstallAppButton />
      <DropdownMenu>
        <DropdownMenuTrigger render={
          <Button variant="ghost" size="sm" className="h-8 gap-2 rounded-lg px-2.5 text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground" />
        }>
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
            <User className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="hidden text-[13px] font-medium sm:inline">{session?.user?.name ?? "User"}</span>
          <Badge
            variant={isOwner ? "default" : "secondary"}
            className="hidden border-0 bg-primary/10 px-1.5 py-0 text-[10px] font-semibold text-primary sm:inline-flex"
          >
            {isOwner ? "Owner" : "Staff"}
          </Badge>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 rounded-xl">
          <DropdownMenuItem onClick={() => router.push("/profile")} className="rounded-lg">
            <UserCircle className="mr-2 h-4 w-4" />
            Profil
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/tickets")} className="rounded-lg">
            <LifeBuoy className="mr-2 h-4 w-4" />
            Bantuan
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleSignOut} className="rounded-lg">
            <LogOut className="mr-2 h-4 w-4" />
            Keluar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
