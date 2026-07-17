import { WILDCARD } from "@/lib/permissions/definitions";

export interface RoleColor {
  value: string;
  label: string;
  class: string;
  gradient: string;
}

export const ROLE_COLORS: RoleColor[] = [
  { value: "indigo", label: "Indigo", class: "bg-indigo-500", gradient: "from-indigo-500 to-indigo-600" },
  { value: "blue", label: "Blue", class: "bg-blue-500", gradient: "from-blue-500 to-blue-600" },
  { value: "emerald", label: "Emerald", class: "bg-emerald-500", gradient: "from-emerald-500 to-emerald-600" },
  { value: "amber", label: "Amber", class: "bg-amber-500", gradient: "from-amber-500 to-amber-600" },
  { value: "purple", label: "Purple", class: "bg-purple-500", gradient: "from-purple-500 to-purple-600" },
  { value: "rose", label: "Rose", class: "bg-rose-500", gradient: "from-rose-500 to-rose-600" },
  { value: "teal", label: "Teal", class: "bg-teal-500", gradient: "from-teal-500 to-teal-600" },
  { value: "orange", label: "Orange", class: "bg-orange-500", gradient: "from-orange-500 to-orange-600" },
];

export function colorClass(color: string): string {
  return ROLE_COLORS.find((c) => c.value === color)?.class ?? "bg-purple-500";
}

export function colorGradient(color: string): string {
  return ROLE_COLORS.find((c) => c.value === color)?.gradient ?? "from-purple-500 to-purple-600";
}

export interface RoleLike {
  permissions: string[];
}

export function isOwnerRole(role: RoleLike | undefined | null): boolean {
  return !!role?.permissions?.includes(WILDCARD);
}
