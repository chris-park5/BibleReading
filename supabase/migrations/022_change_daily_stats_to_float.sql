-- ==============================================================================
-- 22. Change count in daily_reading_stats to NUMERIC for fractional support
-- ==============================================================================

ALTER TABLE daily_reading_stats 
ALTER COLUMN count TYPE NUMERIC(10, 2);