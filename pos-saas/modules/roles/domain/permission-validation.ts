import { ALL_PERMISSIONS, WILDCARD } from "@/lib/permissions/definitions";

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate a list of permission strings.
 *
 * Rules:
 *   1. Every entry must be "*" or a known permission string.
 *   2. Wildcard ("*") is reserved for the Owner role only.
 *
 * @param permissions  The permission strings to validate.
 * @param isOwnerRole  Whether this is the system Owner role (may keep wildcard).
 */
export function validatePermissions(
  permissions: string[],
  isOwnerRole: boolean,
): ValidationResult {
  const allValid = permissions.every(
    (p) => p === WILDCARD || ALL_PERMISSIONS.includes(p as any),
  );
  if (!allValid) {
    return { valid: false, error: "Invalid permission string" };
  }

  if (permissions.includes(WILDCARD) && !isOwnerRole) {
    return {
      valid: false,
      error: "Wildcard permission is reserved for the Owner role",
    };
  }

  return { valid: true };
}

/**
 * Check whether a role holds the wildcard permission.
 */
export function isOwnerRole(permissions: string[]): boolean {
  return permissions.includes(WILDCARD);
}
