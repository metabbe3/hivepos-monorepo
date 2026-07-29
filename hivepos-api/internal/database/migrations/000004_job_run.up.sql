-- 000004_job_run.up.sql
-- Durable record of background-job executions. The photo-cleanup + self-heal
-- tickers were purely in-memory: a crash mid-run left no trace of when they
-- last ran or what they did. JobRun gives observability + crash evidence.
-- Additive: a brand-new table, no existing data touched, no behavior change.
CREATE TABLE "JobRun" (
    id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
    job_name text NOT NULL,                       -- photo_cleanup | self_heal_alert | ...
    started_at timestamptz NOT NULL DEFAULT NOW(),
    completed_at timestamptz,
    status text NOT NULL,                         -- running | completed | failed
    result jsonb,                                 -- {"deleted_photos":42,"purged_errorlog":7}
    error_message text
);
CREATE INDEX "JobRun_job_name_started_at_idx" ON "JobRun" (job_name, started_at DESC);
