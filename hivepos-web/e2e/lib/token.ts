import { readFileSync } from "node:fs";

// Reads the JWT minted ONCE by global-setup (stored in .e2e/auth.json) so specs
// don't each POST /api/auth/login. Re-login-per-test blew past the 20/min login
// limiter ( RATE_LIMITED 429 → `.data.token` undefined → cascade of false failures).
// ponytail: in-memory cache — one token per process; global-setup refreshes the file each run.
// Upgrade path: if a test needs a fresh session, add an explicit login helper there.

const STATE = ".e2e/auth.json";
let cached: string | undefined;

export async function apiToken(): Promise<string> {
  if (cached) return cached;
  const state = JSON.parse(readFileSync(STATE, "utf8"));
  const tok = state.origins?.[0]?.localStorage?.find((l: { name: string }) => l.name === "hivepos_token")?.value;
  if (!tok) throw new Error("[lib/token] no hivepos_token in .e2e/auth.json — global-setup must run first");
  cached = tok;
  return tok;
}
