"use client";

import { Crown, Shield, ShieldCheck, Users, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Role } from "./types";
import { colorClass, colorGradient, isOwnerRole } from "./colors";
import { TOTAL_PERMISSIONS } from "./permission-groups";
import { PermissionSummaryBar } from "./permission-summary-bar";

interface RoleCardProps {
  role: Role;
  onEdit: (role: Role) => void;
  onDelete: (role: Role) => void;
}

export function RoleCard({ role, onEdit, onDelete }: RoleCardProps) {
  const isOwner = isOwnerRole(role);
  const Icon = isOwner ? Crown : role.isSystem ? Shield : ShieldCheck;

  return (
    <Card
      onClick={() => onEdit(role)}
      className={cn(
        "group relative cursor-pointer overflow-hidden",
        "ring-1 ring-foreground/10 shadow-sm",
        "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:ring-foreground/15",
        "animate-fade-in-up",
      )}
    >
      {/* Accent strip */}
      <div
        className={cn(
          "h-1 w-full bg-gradient-to-r",
          colorGradient(role.color),
        )}
      />

      <CardContent className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm",
              "transition-transform duration-200 group-hover:scale-110",
              colorClass(role.color),
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate font-semibold leading-tight">
                {role.name}
              </h3>
              {isOwner && (
                <Badge className="gap-1 bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-900/40 dark:text-amber-300">
                  <Crown className="h-3 w-3" /> Owner
                </Badge>
              )}
              {!isOwner && role.isSystem && (
                <Badge
                  variant="secondary"
                  className="text-[10px] uppercase tracking-wide"
                >
                  System
                </Badge>
              )}
            </div>
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
              {role.description ||
                (isOwner ? "Akses penuh ke semua fitur" : "Custom role")}
            </p>
          </div>
        </div>

        {/* Permission summary */}
        <PermissionSummaryBar
          count={role.permissions.length}
          total={TOTAL_PERMISSIONS}
          locked={isOwner}
          size="sm"
        />

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border/40 pt-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span className="tabular-nums">{role.userCount ?? 0} staff</span>
          </div>
          <div className="flex items-center gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(role);
              }}
              aria-label="Edit role"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            {!role.isSystem && (
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(role);
                }}
                aria-label="Delete role"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
