-- ============================================
-- 11. Fix order_index to be unique and sequential
-- ============================================

-- Re-assign order_index to ensure it is unique and sequential for every day in preset_schedules
-- We use existing order_index as primary sort, then book/chapters, then id for determinism.
WITH ranked_presets AS (
  SELECT 
    id, 
    ROW_NUMBER() OVER (
      PARTITION BY preset_id, day 
      ORDER BY order_index ASC, book ASC, chapters ASC, id ASC
    ) - 1 as new_order
  FROM preset_schedules
)
UPDATE preset_schedules
SET order_index = ranked_presets.new_order
FROM ranked_presets
WHERE preset_schedules.id = ranked_presets.id;

-- Re-assign order_index for plan_schedules
WITH ranked_plans AS (
  SELECT 
    id, 
    ROW_NUMBER() OVER (
      PARTITION BY plan_id, day 
      ORDER BY order_index ASC, book ASC, chapters ASC, id ASC
    ) - 1 as new_order
  FROM plan_schedules
)
UPDATE plan_schedules
SET order_index = ranked_plans.new_order
FROM ranked_plans
WHERE plan_schedules.id = ranked_plans.id;
