-- ==============================================================================
-- 23. Add Chapter Count to Schedules (Performance Optimization)
-- ==============================================================================

ALTER TABLE preset_schedules 
ADD COLUMN IF NOT EXISTS chapter_count INTEGER DEFAULT 0;

ALTER TABLE plan_schedules 
ADD COLUMN IF NOT EXISTS chapter_count INTEGER DEFAULT 0;

-- Optional: Index for aggregation if needed, but usually we filter by plan_id
-- CREATE INDEX idx_preset_schedules_count ON preset_schedules (preset_id, day) INCLUDE (chapter_count);
