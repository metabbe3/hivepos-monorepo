import { prisma } from "@/lib/prisma";

// ponytail: one row per key (key is PK). No typed registry — callers know
// what they wrote. If this grows past ~10 keys, add a `Prisma.TransactionClient`
// variant + typed keys. Until then YAGNI.

/** Returns the stored value, or `null` when the key does not exist. */
export async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.systemSetting.findUnique({ where: { key } });
  return row?.value ?? null;
}
