# SOP: Frontend (Pages + Components)

How to build pages and wire client components in this codebase.

## Server component pattern

Server components handle auth and data fetching, then render a client component for interactivity.

### Tenant dashboard page

```typescript
// app/(dashboard)/example/page.tsx
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ExampleManager } from "./example-manager";

export default async function ExamplePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Optional: pre-fetch data here and pass as props
  return <ExampleManager />;
}
```

### Super-admin page

```typescript
// app/super-admin/(panel)/example/page.tsx
import { requireSuperAdminPanelSession } from "@/lib/super-admin/permissions";
import { ExampleManager } from "./example-manager";

export default async function ExamplePage() {
  // Throws/redirects: /super-admin/login if unauth, /dashboard if wrong role
  await requireSuperAdminPanelSession();
  return <ExampleManager />;
}
```

**Path convention**: super-admin panel pages live under `app/super-admin/(panel)/` (route group, doesn't affect URL).

## Client component pattern

```typescript
// app/(dashboard)/example/example-manager.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { apiFetch, ApiClientError } from "@/modules/shared";
import { useTranslation } from "@/hooks/use-translation";
import { usePermissions } from "@/hooks/use-permissions";
import { Button } from "@/components/ui/button";

interface Item { id: string; name: string; }

export function ExampleManager() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();
  const { can } = usePermissions();
  const router = useRouter();

  const fetchItems = useCallback(() => {
    setLoading(true);
    apiFetch<{ items: Item[] }>("/api/example")
      .then((r) => setItems(r.data?.items ?? []))
      .catch((err) =>
        toast.error(err instanceof ApiClientError ? err.message : "Failed to load"),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  async function handleDelete(id: string) {
    try {
      await apiFetch(`/api/example/${id}`, { method: "DELETE" });
      toast.success(t("common.deleted"));
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Delete failed");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t("example.title")}</h1>

      {can("example", "create") && (
        <Button onClick={() => router.push("/example/new")}>
          {t("common.create")}
        </Button>
      )}

      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between px-5 py-3">
            <span className="font-medium">{item.name}</span>
            <Button size="sm" variant="ghost" onClick={() => handleDelete(item.id)}>
              Delete
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## Translation hook (`hooks/use-translation.ts`)

```typescript
const { t, lang, setLang } = useTranslation();

// Simple
<h1>{t("orders.title")}</h1>

// With placeholder — t() has NO interpolation, use manual replace
const byLine = t("tickets.by")
  .replace("{name}", ticket.submitterName)
  .replace("{date}", new Date(ticket.createdAt).toLocaleString(locale));

// Locale-aware date
const locale = lang === "id" ? "id-ID" : "en-US";
new Date(createdAt).toLocaleString(locale);
```

**Rules:**
- Add keys to BOTH `en` and `id` in `lib/i18n.ts`.
- Dot-notation namespacing: `section.entity.field` (`orders.title`, `common.save`, `nav.dashboard`).
- Missing key returns the key string itself (visible in UI as a regression signal).

## Permission hook (`hooks/use-permissions.ts`)

```typescript
const { can, permissions, isLoading, isSuperAdmin } = usePermissions();

// Gate a button
{can("orders", "create") && <NewOrderButton />}

// Multiple checks
const canEdit = can("customers", "edit");
const canDelete = can("customers", "delete");

// Super-admin bypass
if (isSuperAdmin) { /* always allowed */ }
```

## Feature flag hook (`hooks/use-feature-flag.ts`)

```typescript
import { useFeatureFlag, useFeatureFlags } from "@/hooks/use-feature-flag";

const enabled = useFeatureFlag("inventory");           // single flag, defaults true
const flags = useFeatureFlags();                        // all flags as Record<string, boolean>
```

**Permissive default**: missing flag key → `true` (sidebar stays functional on fresh DB).

## Sidebar SOP (`components/layout/app-sidebar.tsx`)

### NavItem shape

```typescript
type NavItem = {
  titleKey: string;                 // translation key (lib/i18n.ts)
  href: string;                     // route path
  icon: any;                        // lucide-react component
  color: string;                    // tailwind text-color class
  resource: Resource;               // RBAC resource (lib/permissions/definitions.ts)
  action: "read" | "create" | "edit" | "delete";
  badge?: React.ReactNode;          // optional (e.g. <PickupBadge />)
  flag?: FlagKey;                   // optional feature flag gate
};
```

### Four buckets

```typescript
MODULE_NAV: Record<string, NavItem[]> = {
  laundry: [...],
  fnb: [...],
  salon: [...],
};

SHARED_NAV: NavItem[] = [ /* dashboard, customers, reporting */ ];
ADMIN_NAV:  NavItem[] = [ /* branches, users, roles, billing, website */ ];
HELP_NAV:   NavItem[] = [ /* tickets */ ];
```

### Filter rule

```typescript
const flags = useFeatureFlags();
const hasFlag = (key?: FlagKey) => !key || (flags[key] ?? true);

const visible = ITEMS.filter(
  (item) => hasFlag(item.flag) && can(item.resource, item.action),
);
```

**Both checks must remain.** Removing either breaks DRY gating.

### Adding a new nav item

1. Add translation key to both `en` and `id` in `lib/i18n.ts` (e.g. `"nav.yourFeature": "Your Feature"` / `"Fitur Anda"`).
2. Pick the right bucket:
   - Module-specific (laundry/fnb/salon) → `MODULE_NAV[module]`
   - Cross-module → `SHARED_NAV`
   - Admin → `ADMIN_NAV`
   - Help (always visible to logged-in users) → `HELP_NAV`
3. Attach `flag: "yourFeature"` if the feature is flag-gated.

### Module selector

`MODULE_META` controls the module switcher at the top of the sidebar:

```typescript
export const MODULE_META = {
  laundry: { labelKey: "nav.moduleLaundry", icon: ShoppingCart, emoji: "🧺" },
  fnb:     { labelKey: "nav.moduleFnb",     icon: Soup,         emoji: "🍽️" },
  salon:   { labelKey: "nav.moduleSalon",   icon: Scissors,     emoji: "💇" },
};
```

Label is resolved at render time via `t(MODULE_META[activeModule].labelKey)`.

## Super-admin sidebar (`components/layout/super-admin-sidebar.tsx`)

Different structure — grouped into 3 sections:

```typescript
const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  { label: "Monitor",    items: [Overview, Performance, Health, Pickup Insights] },
  { label: "Customers",  items: [Tenants, Plans, Promo Codes, Billing, Users] },
  { label: "Operations", items: [Tickets, Error Logs, Audit Log, Admins*, Feature Flags*, Settings] },
];
```

`*` = `superAdminOnly: true` — hidden from `SUPPORT` role, visible only to `SUPER_ADMIN`.

NavItem shape: `{ title: string; href: string; icon: any; superAdminOnly?: boolean }`.

**No translation keys** — super-admin labels are English-only (admin-only UI).

## Common UI components

| Need | Use |
|---|---|
| Card container | `<section className="rounded-xl border border-border bg-card">` (inline, not a component) |
| Buttons | `<Button>` from `@/components/ui/button` — variants: default, outline, ghost, destructive; sizes: sm, default, lg |
| Inputs | `<Input>`, `<Textarea>`, `<Select>`, `<Switch>`, `<Checkbox>` from `@/components/ui/*` |
| Dialogs/modals | `<Dialog>` from `@/components/ui/dialog` |
| Toasts | `import { toast } from "sonner"; toast.success(...); toast.error(...);` |
| Badges | `<Badge variant="default" | "secondary" | "destructive" | "outline">` |
| Loading spinner | `<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />` |
| Empty state | `<EmptyState>` from `@/components/shared/empty-state` |
| Page header | `<PageHeader>` from `@/components/shared/page-header` |
| Stat card | `<StatCard>` from `@/components/shared/stat-card` |
| Date range | `<DateRangePicker>` from `@/components/shared/date-range-picker` |

## ALL-outlets mode

When `branchId === "ALL"` (user picked "Semua Outlet"):
- Sidebar hides module nav (only Dashboard + Reporting shown)
- API queries drop the `branchId` filter
- Use `useRole()` to read `branchId` and check for `"ALL"`
