"use client";

import { WILDCARD } from "@/lib/permissions/definitions";
import type { Role } from "./types";
import { RoleCard } from "./role-card";

interface RoleListProps {
  roles: Role[];
  onEdit: (role: Role) => void;
  onDelete: (role: Role) => void;
}

function sortRoles(roles: Role[]): Role[] {
  return [...roles].sort((a, b) => {
    const aOwner = a.permissions.includes(WILDCARD) ? 0 : 1;
    const bOwner = b.permissions.includes(WILDCARD) ? 0 : 1;
    if (aOwner !== bOwner) return aOwner - bOwner;
    if (a.isSystem !== b.isSystem) return a.isSystem ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function RoleList({ roles, onEdit, onDelete }: RoleListProps) {
  const sorted = sortRoles(roles);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{roles.length}</span>{" "}
          role total
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((role) => (
          <RoleCard
            key={role.id}
            role={role}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}
