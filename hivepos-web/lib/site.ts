// ponytail: env-backed site origin so metadata/sitemap/robots share one source.
// Assumes NEXT_PUBLIC_BASE_URL is a bare origin (no path/port) — true for hivepos.id.
// To repoint at a staging mirror or new domain, set NEXT_PUBLIC_BASE_URL once here.
export const SITE_URL = (process.env.NEXT_PUBLIC_BASE_URL ?? "https://hivepos.id").replace(/\/$/, "");
export const SITE_DOMAIN = SITE_URL.replace(/^https?:\/\//, ""); // "hivepos.id"
