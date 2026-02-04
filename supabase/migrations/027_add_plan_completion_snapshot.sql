-- Store completion report snapshot (so we can purge custom plan_schedules)

ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS completion_snapshot JSONB;
