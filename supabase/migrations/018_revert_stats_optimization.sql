-- ==============================================================================
-- 18. Revert Stats Optimization (Remove Cached Stats)
-- ==============================================================================

-- 1. Drop Triggers and Functions associated with User Stats Caching
DROP TRIGGER IF EXISTS tr_update_user_stats ON daily_reading_stats;
DROP FUNCTION IF EXISTS public.update_user_stats_cache();

-- 2. Drop Columns from Users Table
ALTER TABLE users 
DROP COLUMN IF EXISTS achievement_rate,
DROP COLUMN IF EXISTS progress_rate,
DROP COLUMN IF EXISTS completed_chapters_count;

-- 3. Drop Total Chapters from Plans
ALTER TABLE plans 
DROP COLUMN IF EXISTS total_chapters;

ALTER TABLE preset_plans 
DROP COLUMN IF EXISTS total_chapters;
