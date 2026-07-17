import { NextResponse } from "next/server";
import { withErrorHandler } from "@/modules/shared";
import { getSetting } from "@/lib/system-settings";

// ponytail: public + unauthenticated so the SW / client can poll without a
// session. Cache-Control: no-store so CDNs / browsers never hold a stale
// nonce (that would delay force-update by their TTL). One cheap PK lookup.
export const dynamic = "force-dynamic";

export const GET = withErrorHandler(async () => {
  const nonce = (await getSetting("pwa.forceUpdateNonce")) ?? "";
  return NextResponse.json(
    { success: true as const, data: { nonce } },
    {
      status: 200,
      headers: { "Cache-Control": "no-store, max-age=0" },
    },
  );
});
