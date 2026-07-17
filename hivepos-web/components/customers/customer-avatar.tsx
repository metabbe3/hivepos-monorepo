"use client";

import { cn } from "@/lib/utils";
import { avatarColorForName } from "./colors";

interface CustomerAvatarProps {
  name: string;
  /** sm = h-10 w-10 (card), lg = h-16 w-16 (detail header). */
  size?: "sm" | "lg";
  className?: string;
}

/**
 * Derives up to two-character initials from a name.
 *   - "" → "?"
 *   - "Budi" → "BU"
 *   - "John Doe" → "JD"
 *   - "John Michael Doe" → "JD" (first + last)
 */
function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const SIZE_CLASSES: Record<NonNullable<CustomerAvatarProps["size"]>, string> = {
  sm: "h-10 w-10 text-sm",
  lg: "h-16 w-16 text-xl",
};

export function CustomerAvatar({
  name,
  size = "sm",
  className,
}: CustomerAvatarProps) {
  return (
    <div
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl font-semibold text-white shadow-sm select-none",
        SIZE_CLASSES[size],
        avatarColorForName(name),
        className,
      )}
    >
      {getInitials(name)}
    </div>
  );
}

export { getInitials };
