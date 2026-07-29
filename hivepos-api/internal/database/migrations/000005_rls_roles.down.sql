-- 000005_rls_roles.down.sql
-- Reverse: drop the Phase-1 roles. A role can't be dropped while it still holds
-- privileges/ownership, so REASSIGN + DROP OWNED first. Safe — app is on posadmin.
REASSIGN OWNED BY hivepos_app TO posadmin;
REASSIGN OWNED BY hivepos_admin TO posadmin;
DROP OWNED BY hivepos_app;
DROP OWNED BY hivepos_admin;
DROP ROLE IF EXISTS hivepos_app;
DROP ROLE IF EXISTS hivepos_admin;
