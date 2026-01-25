-- ============================================
-- 10. Add order_index to schedules
-- ============================================

-- Add order_index to plan_schedules
ALTER TABLE plan_schedules 
ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;

-- Add order_index to preset_schedules
ALTER TABLE preset_schedules 
ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;

-- Optional: Update existing records to have sequential order based on current book order
-- This is a best-effort migration for existing data.
-- We use a window function to assign an index based on the current default sort (book name).
WITH ranked_schedules AS (
  SELECT 
    id, 
    ROW_NUMBER() OVER (PARTITION BY plan_id, day ORDER BY book, chapters) - 1 as new_order
  FROM plan_schedules
)
UPDATE plan_schedules
SET order_index = ranked_schedules.new_order
FROM ranked_schedules
WHERE plan_schedules.id = ranked_schedules.id;

WITH ranked_presets AS (
  SELECT 
    id, 
    ROW_NUMBER() OVER (PARTITION BY preset_id, day ORDER BY book, chapters) - 1 as new_order
  FROM preset_schedules
)
UPDATE preset_schedules
SET order_index = ranked_presets.new_order
FROM ranked_presets
WHERE preset_schedules.id = ranked_presets.id;
