-- ==============================================================================
-- 24. Change chapter_count to NUMERIC for fractional support
-- ==============================================================================

ALTER TABLE preset_schedules 
ALTER COLUMN chapter_count TYPE NUMERIC(10, 2);

ALTER TABLE plan_schedules 
ALTER COLUMN chapter_count TYPE NUMERIC(10, 2);
