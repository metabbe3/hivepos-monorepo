// ponytail: token in localStorage so client fetch can attach it as Bearer.
// Upgrade path: move to an httpOnly cookie set by a thin Next BFF /auth route
// (proxy login, set cookie, strip token from JS) once SSR/secure-sessions land.
const KEY = "hivepos_token";

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEY);
}

export function setAuthToken(token: string): void {
  if (typeof window !== "undefined") localStorage.setItem(KEY, token);
}

export function clearAuthToken(): void {
  if (typeof window !== "undefined") localStorage.removeItem(KEY);
}
