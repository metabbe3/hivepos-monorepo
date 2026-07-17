import type { UserRole } from "@/app/generated/prisma/enums";

/** Full profile payload from GET /api/user/profile. */
export interface ProfileData {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: UserRole;
  createdAt: string;
  googleId?: string | null;
  avatar?: string | null;
}

/** Password change form state. */
export interface PasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/** Strength score 0–4 with matching tier metadata. */
export interface StrengthResult {
  score: 0 | 1 | 2 | 3 | 4;
  /** Tailwind classes for the filled segments + label. */
  segmentClass: string;
  labelKey: string;
}

/** Requirement check used by the checklist UI. */
export interface PasswordRequirement {
  labelKey: string;
  met: boolean;
}
