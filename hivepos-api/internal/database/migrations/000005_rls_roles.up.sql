-- 000005_rls_roles.up.sql
-- Phase-1 enforcement PREP: the two Postgres roles RLS needs. SAFE to apply — it
-- only CREATES roles + grants privileges. The app still connects as `posadmin`
-- (superuser → bypasses RLS unconditionally), so applying this changes NOTHING
-- until the app DSN switches to hivepos_app (the staging-gated flip in the runbook).
--
-- Why two roles:
--   hivepos_app   — NOSUPERUSER, NOBYPASSRLS → SUBJECT to the RLS policies.
--                   Tenant-scoped request handlers connect (or SET ROLE) as this.
--   hivepos_admin — NOSUPERUSER, BYPASSRLS   → skips RLS without superuser powers.
--                   Background workers + super-admin cross-tenant routes use this.

-- App role: subject to RLS. NOLOGIN — posadmin SETs ROLE to it per connection
-- (or a LOGIN member role is created at flip time). See docs/rls-rollout.md.
CREATE ROLE hivepos_app NOSUPERUSER NOBYPASSRLS NOLOGIN;
GRANT USAGE ON SCHEMA public TO hivepos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO hivepos_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO hivepos_app;
-- Future tables (new migrations) auto-grant to hivepos_app.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO hivepos_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO hivepos_app;

-- Admin/bypass role: skips RLS (workers + super-admin cross-tenant).
CREATE ROLE hivepos_admin NOSUPERUSER BYPASSRLS NOLOGIN;
GRANT USAGE ON SCHEMA public TO hivepos_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO hivepos_admin;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO hivepos_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO hivepos_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO hivepos_admin;
