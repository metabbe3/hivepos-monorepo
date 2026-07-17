import { cn } from "@/lib/utils";

/**
 * Deterministic 10-color palette for the avatar background (independent of role).
 * Same distribution algorithm as the customers module — single-user context here,
 * so collisions are a non-issue.
 */
export const AVATAR_PALETTE = [
  "bg-indigo-500",
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-purple-500",
  "bg-rose-500",
  "bg-teal-500",
  "bg-orange-500",
  "bg-cyan-500",
  "bg-pink-500",
] as const;

/**
 * Derives up to two-character initials from a name.
 *   - "" → "?"
 *   - "Budi" → "BU"
 *   - "John Doe" → "JD"
 *   - "John Michael Doe" → "JD" (first + last)
 */
export function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Deterministic palette index for a name. Uses the classic Java String
 * hashCode multiplier (31) which distributes well for short strings.
 */
export function avatarColorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0; // force 32-bit
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

interface ProfileAvatarProps {
  name: string;
  /** lg = h-16 w-16, xl = h-24 w-24 (hero). */
  size?: "lg" | "xl";
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<ProfileAvatarProps["size"]>, string> = {
  lg: "h-16 w-16 text-xl",
  xl: "h-24 w-24 text-3xl",
};

export function ProfileAvatar({
  name,
  size = "lg",
  className,
}: ProfileAvatarProps) {
  return (
    <div
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-2xl font-bold text-white select-none",
        SIZE_CLASSES[size],
        avatarColorForName(name),
        className,
      )}
    >
      {getInitials(name)}
    </div>
  );
}
