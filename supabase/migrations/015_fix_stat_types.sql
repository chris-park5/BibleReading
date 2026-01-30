-- ==============================================================================
-- 15. Fix Stat Types & Precision
-- ==============================================================================

-- 1. Change completed_chapters_count to NUMERIC to support partial chapters
ALTER TABLE users 
ALTER COLUMN completed_chapters_count TYPE NUMERIC(10, 2);

-- 2. Update the trigger function to also calculate and update achievement_rate
CREATE OR REPLACE FUNCTION public.update_user_stats_cache()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_plan_id UUID;
  v_completed_chapters NUMERIC(10, 2) := 0;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_user_id := OLD.user_id;
  ELSE
    v_user_id := NEW.user_id;
  END IF;

  -- Get current shared plan
  SELECT shared_plan_id INTO v_plan_id FROM users WHERE id = v_user_id;
  
  IF v_plan_id IS NULL THEN
    UPDATE users 
    SET achievement_rate = 0, completed_chapters_count = 0, last_stat_update = NOW()
    WHERE id = v_user_id;
    RETURN NULL;
  END IF;

  -- Sum up from daily_reading_stats (This is the most efficient way)
  SELECT COALESCE(SUM(count), 0) INTO v_completed_chapters
  FROM daily_reading_stats
  WHERE user_id = v_user_id AND plan_id = v_plan_id;

  -- Note: We don't calculate rate here because getting the 'Total Plan Chapters' 
  -- requires heavy schedule parsing which is slow for a trigger.
  -- The rate will be updated via the Backfill script or when the user opens the app.
  
  UPDATE users
  SET completed_chapters_count = v_completed_chapters,
      last_stat_update = NOW()
  WHERE id = v_user_id;

  RETURN NULL;
END;
$$;
