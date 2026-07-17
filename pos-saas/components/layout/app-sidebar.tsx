"use client";

import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  Sparkles,
  BarChart3,
  Building2,
  UserCog,
  Package,
  Receipt,
  UtensilsCrossed,
  Scissors,
  Soup,
  CreditCard,
  ShieldCheck,
  Truck,
  Globe,
  MessageCircle,
  LifeBuoy,
  Printer,
  Clock,
  ClipboardList,
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
import { useRole } from "@/hooks/use-role";
import { usePermissions } from "@/hooks/use-permissions";
import type { Resource } from "@/lib/permissions/definitions";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { LanguageToggle } from "@/components/shared/language-toggle";
import { ModuleSelector } from "@/components/shared/module-selector";
import { PickupBadge } from "@/components/dashboard/pickup-badge";
import { useTranslation } from "@/hooks/use-translation";
import { useFeatureFlags } from "@/hooks/use-feature-flag";
import type { FlagKey } from "@/lib/feature-flags";

type NavItem = {
  titleKey: string;
  href: string;
  icon: any;
  color: string;
  resource: Resource;
  action: "read" | "create" | "edit" | "delete";
  /** Optional ReactNode rendered after the label (e.g. a count badge). */
  badge?: React.ReactNode;
  /** Feature flag gating. Undefined = always visible (current behavior). */
  flag?: FlagKey;
};

// ── Module-specific nav items ──
const MODULE_NAV: Record<string, NavItem[]> = {
  laundry: [
    { titleKey: "nav.orders", href: "/laundry/orders", icon: ShoppingCart, color: "text-sky-600", resource: "orders", action: "read", flag: "orders" },
    { titleKey: "nav.pickup", href: "/laundry/pickup-requests", icon: Truck, color: "text-indigo-600", resource: "pickupRequests", action: "read", badge: <PickupBadge />, flag: "pickupRequests" },
    { titleKey: "nav.services", href: "/laundry/services", icon: Sparkles, color: "text-emerald-600", resource: "services", action: "read", flag: "services" },
    { titleKey: "nav.inventory", href: "/laundry/inventory", icon: Package, color: "text-teal-600", resource: "inventory", action: "read", flag: "inventory" },
    { titleKey: "nav.expenses", href: "/laundry/expenses", icon: Receipt, color: "text-indigo-600", resource: "expenses", action: "read", flag: "expenses" },
  ],
  fnb: [
    { titleKey: "nav.orders", href: "/laundry/orders", icon: ShoppingCart, color: "text-sky-600", resource: "orders", action: "read", flag: "orders" },
    { titleKey: "nav.menu", href: "/laundry/services", icon: UtensilsCrossed, color: "text-emerald-600", resource: "services", action: "read", flag: "services" },
  ],
  salon: [
    { titleKey: "nav.orders", href: "/laundry/orders", icon: Scissors, color: "text-sky-600", resource: "orders", action: "read", flag: "orders" },
    { titleKey: "nav.services", href: "/laundry/services", icon: Sparkles, color: "text-emerald-600", resource: "services", action: "read", flag: "services" },
  ],
};

// Shared sections — cross-module
const SHARED_NAV: NavItem[] = [
  { titleKey: "nav.dashboard", href: "/dashboard", icon: LayoutDashboard, color: "text-indigo-600", resource: "dashboard", action: "read", flag: "dashboard" },
  { titleKey: "nav.attendance", href: "/attendance/clock", icon: Clock, color: "text-amber-600", resource: "attendance", action: "read", flag: "staffAttendance" },
  { titleKey: "nav.attendanceManage", href: "/attendance/manage", icon: ClipboardList, color: "text-indigo-600", resource: "attendance", action: "edit", flag: "staffAttendance" },
  { titleKey: "nav.customers", href: "/customers", icon: Users, color: "text-indigo-600", resource: "customers", action: "read", flag: "customers" },
  { titleKey: "nav.reporting", href: "/reporting", icon: BarChart3, color: "text-violet-600", resource: "reports", action: "read", flag: "reports" },
  // ponytail: printer settings is device-level (localStorage) so it stays visible
  // even in "Semua Outlet" mode. Gated by orders:read → kasir, manager, owner.
  { titleKey: "nav.printerSettings", href: "/printer-settings", icon: Printer, color: "text-slate-600", resource: "orders", action: "read", flag: "printerSettings" },
];

const ADMIN_NAV: NavItem[] = [
  { titleKey: "nav.branches", href: "/branches", icon: Building2, color: "text-indigo-600", resource: "branches", action: "read", flag: "branches" },
  { titleKey: "nav.users", href: "/users", icon: UserCog, color: "text-purple-600", resource: "users", action: "read", flag: "users" },
  { titleKey: "nav.roles", href: "/roles", icon: ShieldCheck, color: "text-indigo-600", resource: "roles", action: "read", flag: "roles" },
  { titleKey: "nav.billing", href: "/billing", icon: CreditCard, color: "text-green-600", resource: "billing", action: "read", flag: "billing" },
  { titleKey: "nav.website", href: "/website", icon: Globe, color: "text-sky-600", resource: "billing", action: "read", flag: "website" },
  { titleKey: "nav.whatsappTemplates", href: "/whatsapp-templates", icon: MessageCircle, color: "text-emerald-600", resource: "billing", action: "read" },
];

// Help/Bantuan — always visible to every logged-in user. Ponytail: no RBAC
// resource, so it lives outside SHARED_NAV's permission filter.
const HELP_NAV: NavItem[] = [
  { titleKey: "nav.help", href: "/tickets", icon: LifeBuoy, color: "text-indigo-600", resource: "dashboard", action: "read", flag: "tickets" },
];

// Module metadata for switcher. Label resolved at render time via t().
export const MODULE_META: Record<string, { labelKey: string; icon: any; emoji: string }> = {
  laundry: { labelKey: "nav.moduleLaundry", icon: ShoppingCart, emoji: "🧺" },
  fnb: { labelKey: "nav.moduleFnb", icon: Soup, emoji: "🍽️" },
  salon: { labelKey: "nav.moduleSalon", icon: Scissors, emoji: "💇" },
};

// ponytail: NavList — the four SidebarGroup blocks below previously
// copy-pasted ~30 lines of SidebarMenu/SidebarMenuItem/SidebarMenuButton
// each. Now they delegate here. Per-group differences (accent color,
// active-route resolver, badge) come via props.
function NavList({
  items,
  accentColor = "bg-indigo-500",
  isActive,
}: {
  items: NavItem[];
  accentColor?: string;
  isActive?: (item: NavItem) => boolean;
}) {
  const pathname = usePathname();
  const { t } = useTranslation();
  return (
    <SidebarMenu>
      {items.map((item) => {
        const active = isActive ? isActive(item) : pathname.startsWith(item.href);
        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              isActive={active}
              render={<a href={item.href} />}
              className={`group relative rounded-lg transition-all duration-200 hover:bg-sidebar-accent/60 ${
                active ? "bg-sidebar-accent/80 font-semibold" : ""
              }`}
            >
              {active && (
                <div className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full ${accentColor}`} />
              )}
              <item.icon className={`h-[18px] w-[18px] transition-colors ${active ? item.color : "text-muted-foreground group-hover:text-foreground"}`} />
              <span className="text-[13px]">{t(item.titleKey)}</span>
              {item.badge}
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const { tenantName, activeModule, branchId } = useRole();
  const { can } = usePermissions();
  const { t } = useTranslation();
  const flags = useFeatureFlags();
  // ponytail: flag check is permissive on missing keys (defaults to true) — keeps the
  // sidebar functional even on a fresh DB without seeded flags.
  const hasFlag = (key?: FlagKey) => !key || (flags[key] ?? true);

  // Active module is tracked in the session so that shared pages (e.g. /dashboard)
  // still show the user's last-picked module submenu.
  const effectiveModule = activeModule || "laundry";

  // "Semua Outlet" (ALL) mode: only Dashboard + Laporan are relevant.
  // Operational pages are branch-specific and hidden.
  const isAllOutlets = branchId === "ALL";

  const moduleItems = (MODULE_NAV[effectiveModule] ?? []).filter(
    (item) => hasFlag(item.flag) && can(item.resource, item.action),
  );

  const visibleShared = SHARED_NAV.filter((item) => {
    if (isAllOutlets) {
      // In ALL mode, only Dashboard + Laporan + Printer settings are meaningful
      return (
        (item.href === "/dashboard" || item.href === "/reporting" || item.href === "/printer-settings") &&
        hasFlag(item.flag) &&
        can(item.resource, item.action)
      );
    }
    return hasFlag(item.flag) && can(item.resource, item.action);
  });

  const visibleModule = isAllOutlets ? [] : moduleItems;

  const visibleAdmin = ADMIN_NAV.filter(
    (item) => hasFlag(item.flag) && can(item.resource, item.action),
  );

  const visibleHelp = HELP_NAV.filter((item) => hasFlag(item.flag));

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border/60 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-white">
            <BrandMark className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="block truncate text-lg font-bold tracking-tight">
              {tenantName || "hivePOS"}
            </span>
            {/* Module selector replaces the static subtitle label */}
            <div className="mt-0.5">
              <ModuleSelector />
            </div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 pt-2">
        {/* Shared Nav (Dashboard, Customers, Reports) */}
        <SidebarGroup>
          <SidebarGroupLabel className="px-2 text-[11px] font-semibold tracking-wider text-muted-foreground/70 uppercase">
            {t("nav.general")}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <NavList
              items={visibleShared}
              isActive={(item) =>
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.href)
              }
            />
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Active Module Nav */}
        {activeModule && visibleModule.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="px-2 text-[11px] font-semibold tracking-wider text-muted-foreground/70 uppercase">
              {MODULE_META[activeModule]?.emoji} {MODULE_META[activeModule] ? t(MODULE_META[activeModule].labelKey) : ""}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <NavList items={visibleModule} />
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Admin Nav — permission-filtered */}
        {visibleAdmin.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="px-2 text-[11px] font-semibold tracking-wider text-muted-foreground/70 uppercase">
              {t("nav.admin")}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <NavList items={visibleAdmin} />
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Help — always visible (no RBAC gate, but still flag-gated) */}
        {visibleHelp.length > 0 && (
          <SidebarGroup>
            <SidebarGroupContent>
              <NavList items={visibleHelp} accentColor="bg-indigo-500" />
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      {/* Footer with toggles */}
      <SidebarFooter className="border-t border-sidebar-border/60 px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
