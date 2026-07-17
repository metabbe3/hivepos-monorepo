"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useRole } from "@/hooks/use-role";
import { useSession } from "next-auth/react";
import { Building2, ChevronDown, LayoutGrid } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/modules/shared";

interface Branch {
  id: string;
  name: string;
  isActive: boolean;
}

const ALL_OUTLETS_ROUTES = ["/dashboard", "/reporting", "/branches", "/users", "/billing"];

function isAllOutletsRoute(pathname: string): boolean {
  return ALL_OUTLETS_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"));
}

export function BranchSelector() {
  const pathname = usePathname();
  const { isOwner, branchId, branchName } = useRole();
  const { update } = useSession();
  const [branches, setBranches] = useState<Branch[]>([]);

  const showAllOption = isAllOutletsRoute(pathname);
  const isAllSelected = branchId === "ALL";

  useEffect(() => {
    if (!isOwner) return;
    apiFetch<Branch[]>("/api/branches")
      .then((res) => setBranches(res.data))
      .catch(() => {});
  }, [isOwner]);

  // Route guard: if not on a route that supports "ALL" and "ALL" is selected,
  // switch back to the first branch. Await update() so the session is persisted
  // before reload (otherwise the guard re-fires in a loop).
  useEffect(() => {
    if (!isOwner || branches.length === 0) return;
    if (isAllSelected && !showAllOption) {
      const first = branches[0];
      if (first) {
        (async () => {
          await update({ selectedBranchId: first.id, selectedBranchName: first.name });
          window.location.reload();
        })();
      }
    }
  }, [isOwner, isAllSelected, showAllOption, branches, update]);

  if (!isOwner) return null;

  async function selectBranch(id: string, name: string) {
    await update({ selectedBranchId: id, selectedBranchName: name });
    window.location.reload();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={
        <Button variant="outline" size="sm" className="gap-2 max-w-[200px]" />
      }>
          {isAllSelected ? (
            <LayoutGrid className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <Building2 className="h-3.5 w-3.5 shrink-0" />
          )}
          <span className="truncate text-xs">{isAllSelected ? "Semua Outlet" : (branchName || "Select Branch")}</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {showAllOption && (
          <>
            <DropdownMenuItem
              onClick={() => selectBranch("ALL", "Semua Outlet")}
              className={isAllSelected ? "font-semibold bg-accent" : ""}
            >
              <LayoutGrid className="h-3.5 w-3.5 mr-2" />
              Semua Outlet
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {branches.map((b) => (
          <DropdownMenuItem
            key={b.id}
            onClick={() => selectBranch(b.id, b.name)}
            className={b.id === branchId ? "font-semibold bg-accent" : ""}
          >
            {b.name}
            {!b.isActive && <span className="ml-2 text-xs text-muted-foreground">(inactive)</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
