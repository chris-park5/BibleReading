-- ==============================================================================
-- 17. Add Total Chapters and Enable Progress/Achievement Rates
-- ==============================================================================

-- 1. Add total_chapters to plans and preset_plans
ALTER TABLE preset_plans 
ADD COLUMN IF NOT EXISTS total_chapters INTEGER DEFAULT 0;

ALTER TABLE plans 
ADD COLUMN IF NOT EXISTS total_chapters INTEGER DEFAULT 0;

-- 2. Add progress_rate to users (Overall Completion %)
-- achievement_rate already exists (Schedule Adherence %)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS progress_rate NUMERIC(5, 2) DEFAULT 0;

-- 3. Update the User Stats Trigger
CREATE OR REPLACE FUNCTION public.update_user_stats_cache()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_plan_id UUID;
  v_plan_total_chapters INTEGER;
  v_preset_total_chapters INTEGER;
  v_plan_days INTEGER;
  v_start_date DATE;
  v_completed_chapters NUMERIC(10, 2) := 0;
  v_progress_rate NUMERIC(5, 2) := 0;
  v_achievement_rate NUMERIC(5, 2) := 0;
  
  v_plan_row plans%ROWTYPE;
  v_elapsed_days INTEGER;
  v_expected_chapters NUMERIC(10, 2);
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
    SET achievement_rate = 0, progress_rate = 0, completed_chapters_count = 0, last_stat_update = NOW()
    WHERE id = v_user_id;
    RETURN NULL;
  END IF;

  -- Sum up completed chapters
  SELECT COALESCE(SUM(count), 0) INTO v_completed_chapters
  FROM daily_reading_stats
  WHERE user_id = v_user_id AND plan_id = v_plan_id;

  -- Get Plan Details
  SELECT * INTO v_plan_row FROM plans WHERE id = v_plan_id;
  
  v_plan_total_chapters := v_plan_row.total_chapters;
  v_plan_days := v_plan_row.total_days;
  v_start_date := v_plan_row.start_date;

  -- Fallback: Check Preset for total_chapters
  IF (v_plan_total_chapters IS NULL OR v_plan_total_chapters = 0) AND v_plan_row.preset_id IS NOT NULL THEN
      SELECT total_chapters INTO v_preset_total_chapters 
      FROM preset_plans 
      WHERE id = v_plan_row.preset_id;
      
      IF v_preset_total_chapters IS NOT NULL AND v_preset_total_chapters > 0 THEN
         v_plan_total_chapters := v_preset_total_chapters;
      END IF;
  END IF;

  -- Validations
  IF v_plan_total_chapters IS NULL OR v_plan_total_chapters = 0 THEN
    -- Cannot calculate rates without total
    UPDATE users
    SET completed_chapters_count = v_completed_chapters,
        achievement_rate = 0,
        progress_rate = 0,
        last_stat_update = NOW()
    WHERE id = v_user_id;
    RETURN NULL;
  END IF;

  -- 1. Calculate Progress Rate (Completed / Total)
  v_progress_rate := (v_completed_chapters / v_plan_total_chapters) * 100;
  IF v_progress_rate > 100 THEN v_progress_rate := 100; END IF;

  -- 2. Calculate Achievement Rate (Schedule Adherence)
  -- Expected = Total * (Elapsed / Duration) (Linear Approximation)
  v_elapsed_days := (CURRENT_DATE - v_start_date) + 1; -- +1 to include today
  
  IF v_elapsed_days <= 0 THEN
     -- Before start date
     IF v_completed_chapters > 0 THEN v_achievement_rate := 100; ELSE v_achievement_rate := 0; END IF;
  ELSIF v_elapsed_days > v_plan_days THEN
     -- After end date: Expected is 100%
     v_expected_chapters := v_plan_total_chapters;
     v_achievement_rate := (v_completed_chapters / v_expected_chapters) * 100;
  ELSE
     -- In progress
     v_expected_chapters := v_plan_total_chapters * (v_elapsed_days::NUMERIC / v_plan_days::NUMERIC);
     IF v_expected_chapters < 1 THEN v_expected_chapters := 1; END IF;
     
     v_achievement_rate := (v_completed_chapters / v_expected_chapters) * 100;
  END IF;

  -- Cap Achievement Rate reasonably (e.g. 999%) to fit NUMERIC(5,2)
  IF v_achievement_rate > 999.99 THEN v_achievement_rate := 999.99; END IF;

  -- Update User Stats
  UPDATE users
  SET completed_chapters_count = v_completed_chapters,
      achievement_rate = v_achievement_rate,
      progress_rate = v_progress_rate,
      last_stat_update = NOW()
  WHERE id = v_user_id;

  RETURN NULL;
END;
$$;