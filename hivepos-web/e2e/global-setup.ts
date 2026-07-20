import { mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

// ponytail: seeds an idempotent OWNER test tenant in the shared pos_saas DB
// (Go POST /api/register is currently broken — omits ownerEmail NOT NULL — so
// we bypass it), then logs in via the working /api/auth/login and writes a
// storageState with the JWT. No browser needed → no web-server-up race.
// Upgrade path: drop the seed once hivepos-api/register is fixed.

const API = process.env.E2E_API_BASE_URL ?? "http://localhost:8099/api";
const BASE = process.env.E2E_WEB_BASE_URL ?? "http://localhost:3008";
const EMAIL = "qa@hivepos.local";
const PASSWORD = "Pass1234!";

function seedUser(): void {
  // bcrypt($2a) hash for PASSWORD; execFile (no shell) — only constants interpolated.
  const hash = execFileSync("htpasswd", ["-bnBC", "10", "", PASSWORD])
    .toString()
    .replace(/^:/, "")
    .replace(/\$2y\$/, "$2a$")
    .trim();
  const sql = `BEGIN;
INSERT INTO "Tenant" (id,name,slug,"ownerEmail","ownerName","isActive","websiteEnabled","isDemo","createdAt","updatedAt","onboardingCompletedAt")
VALUES ('qa-tenant-1','QA Test','qa-tenant-1','${EMAIL}','QA Owner',true,true,false,now(),now(),now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO "Branch" (id,name,"isActive","tenantId","printerPort","printerPaperSize","printerEnabled","isFreeTier","createdAt","updatedAt","slug")
VALUES ('qa-branch-1','Main',true,'qa-tenant-1',0,'80mm',false,true,now(),now(),'main') ON CONFLICT (id) DO NOTHING;
INSERT INTO "User" (id,email,"passwordHash",name,role,"tenantId","branchId","sessionVersion","isActive","createdAt","updatedAt")
VALUES ('qa-user-1','${EMAIL}','${hash}','QA Owner','OWNER','qa-tenant-1','qa-branch-1',0,true,now(),now())
ON CONFLICT (id) DO UPDATE SET "passwordHash"=EXCLUDED."passwordHash";
INSERT INTO "Role" (id,name,permissions,color,"tenantId","isSystem","createdAt","updatedAt")
VALUES ('qa-role-staff','Staff',ARRAY['*'],'blue','qa-tenant-1',false,now(),now())
ON CONFLICT (id) DO NOTHING;
-- Pro subscription so e2e can exercise plan-gated features (branch create beyond the
-- 1-outlet Free limit, Pro-only website content, etc.). planlimits.Resolve reads
-- Subscription→Plan with no status filter; PRO plan has maxOutlets/Users/Orders = 999999.
INSERT INTO "Subscription" (id,"tenantId","planId",status,"paidOutletCount","currentPeriodStart","currentPeriodEnd","createdAt","updatedAt")
VALUES ('qa-sub-1','qa-tenant-1',(SELECT id FROM "Plan" WHERE tier='PRO' LIMIT 1),'ACTIVE',1,now(),now() + interval '365 days',now(),now())
ON CONFLICT (id) DO UPDATE SET "planId"=EXCLUDED."planId", status=EXCLUDED.status,
  "paidOutletCount"=EXCLUDED."paidOutletCount", "currentPeriodEnd"=EXCLUDED."currentPeriodEnd", "updatedAt"=now();
COMMIT;`;
  execFileSync("docker", [
    "exec", "hivepos-postgres-1", "psql", "-U", "posadmin", "-d", "pos_saas",
    "-v", "ON_ERROR_STOP=1", "-c", sql,
  ]);
}

export default async function globalSetup(): Promise<void> {
  try {
    seedUser();
  } catch (e) {
    console.warn("[global-setup] seed skipped:", (e as Error).message);
  }

  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const json: any = await res.json().catch(() => null);
  const token = json?.data?.token;
  if (!token) throw new Error(`[global-setup] login failed: ${JSON.stringify(json)}`);

  const state = {
    cookies: [],
    origins: [
      { origin: BASE, localStorage: [{ name: "hivepos_token", value: token }] },
    ],
  };
  mkdirSync(".e2e", { recursive: true });
  writeFileSync(".e2e/auth.json", JSON.stringify(state));
  console.log("[global-setup] authenticated — wrote .e2e/auth.json");
}
