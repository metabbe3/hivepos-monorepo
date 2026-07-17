"use client";

import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  TrendingUp,
  Building2,
  Layers,
  Tag,
  CreditCard,
  ScrollText,
  Users,
  LifeBuoy,
  AlertOctagon,
  Truck,
  Activity,
  ShieldCheck,
  Settings,
  Flag,
  Cable,
  Gift,
  FileText,
} from "lucide-react";
import { BrandMark } from "@/components/public/brand-logo";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { useSession } from "next-auth/react";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { LanguageToggle } from "@/components/shared/language-toggle";

type NavItem = {
  title: string;
  href: string;
  icon: any;
  /** When true, only SUPER_ADMIN role sees this entry. */
  superAdminOnly?: boolean;
};

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Monitor",
    items: [
      { title: "Overview", href: "/super-admin", icon: LayoutDashboard },
      { title: "Performance", href: "/super-admin/performance", icon: TrendingUp },
      { title: "Health", href: "/super-admin/health", icon: Activity },
      { title: "Pickup Insights", href: "/super-admin/pickup-insights", icon: Truck },
      { title: "Peripherals", href: "/super-admin/peripherals", icon: Cable },
    ],
  },
  {
    label: "Customers",
    items: [
      { title: "Tenants", href: "/super-admin/tenants", icon: Building2 },
      { title: "Plans", href: "/super-admin/plans", icon: Layers },
      { title: "Promo Codes", href: "/super-admin/promo-codes", icon: Tag },
      { title: "Referrals", href: "/super-admin/referrals", icon: Gift },
      { title: "Billing", href: "/super-admin/billing", icon: CreditCard },
      { title: "Users", href: "/super-admin/users", icon: Users },
    ],
  },
  {
    label: "Operations",
    items: [
      { title: "Tickets", href: "/super-admin/tickets", icon: LifeBuoy },
      { title: "Error Logs", href: "/super-admin/error-logs", icon: AlertOctagon },
      { title: "Audit Log", href: "/super-admin/audit-log", icon: ScrollText },
      { title: "Admins", href: "/super-admin/admins", icon: ShieldCheck, superAdminOnly: true },
      { title: "Feature Flags", href: "/super-admin/feature-flags", icon: Flag, superAdminOnly: true },
      { title: "Settings", href: "/super-admin/settings", icon: Settings },
    ],
  },
  {
    label: "Content",
    items: [{ title: "Blog", href: "/super-admin/blog", icon: FileText }],
  },
];

export function SuperAdminSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-border px-4 py-4">
        <div className="flex items-center gap-3">
          {/* ponytail: primary-tinted brand tile, matches tenant. */}
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <BrandMark className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold tracking-tight">
              hivePOS Panel
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {role === "SUPER_ADMIN" ? "Super Admin" : "Support"}
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-2 gap-2">
        {NAV_GROUPS.map((group) => {
          const visible = group.items.filter(
            (item) => !item.superAdminOnly || role === "SUPER_ADMIN",
          );
          if (visible.length === 0) return null;
          return (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel className="px-2 text-xs font-medium text-muted-foreground">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visible.map((item) => {
                    const isActive =
                      item.href === "/super-admin"
                        ? pathname === "/super-admin"
                        : pathname.startsWith(item.href);
                    return (
                      <SidebarMenuItem key={item.href}>
                        {/* ponytail: shadcn sidebar default — ghost, muted hover, active = bg-sidebar-accent. */}
                        <SidebarMenuButton
                          isActive={isActive}
                          render={<a href={item.href} />}
                          className="rounded-md font-medium"
                        >
                          <item.icon className="h-4 w-4" />
                          <span className="text-sm">{item.title}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="border-t border-border px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
