import { getDB } from "@/lib/offline/db";

// ponytail: generic form-draft store keyed by route. New Order is the first
// consumer; other forms can adopt by passing their route. Data is opaque JSON
// — each consumer owns its own shape + version. 24h TTL is enforced by the
// consumer (loadDraft returns the timestamp; consumer checks age).

const SCHEMA_VERSION = 1;

export interface FormDraft {
  route: string;
  savedAt: string; // ISO timestamp
  version: number;
  data: unknown;
}

export async function saveDraft(route: string, data: unknown): Promise<void> {
  try {
    const db = await getDB();
    await db.put("formDrafts", {
      route,
      savedAt: new Date().toISOString(),
      version: SCHEMA_VERSION,
      data,
    });
  } catch {
    // ponytail: IDB unavailable (private mode, SSR) — drafts are best-effort.
  }
}

export async function loadDraft(route: string): Promise<FormDraft | undefined> {
  try {
    const db = await getDB();
    return (await db.get("formDrafts", route)) as FormDraft | undefined;
  } catch {
    return undefined;
  }
}

export async function clearDraft(route: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete("formDrafts", route);
  } catch {
    // best-effort
  }
}

// 24 hours — stale drafts (employee didn't come back) shouldn't nag.
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function isDraftFresh(savedAt: string): boolean {
  return Date.now() - new Date(savedAt).getTime() < MAX_AGE_MS;
}
