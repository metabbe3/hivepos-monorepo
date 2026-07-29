-- 000004_job_run.down.sql
-- Reverse: drop the job-run audit table. Safe — additive table, no app data.
DROP TABLE IF EXISTS "JobRun";
