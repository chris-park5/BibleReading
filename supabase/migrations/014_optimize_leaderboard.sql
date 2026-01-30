-- ==============================================================================
-- 14. Optimize Leaderboard Performance (Denormalization)
-- ==============================================================================

-- 1. Add stat columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS achievement_rate NUMERIC(5, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS completed_chapters_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_stat_update TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. Function to calculate and update user stats
CREATE OR REPLACE FUNCTION public.update_user_stats_cache()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_plan_id UUID;
  v_total_chapters INTEGER := 0;
  v_completed_chapters INTEGER := 0;
  v_rate NUMERIC(5, 2) := 0;
  
  -- Variables for schedule calculation
  v_plan_row plans%ROWTYPE;
BEGIN
  -- Determine impacted user
  IF TG_OP = 'DELETE' THEN
    v_user_id := OLD.user_id;
    v_plan_id := OLD.plan_id;
  ELSE
    v_user_id := NEW.user_id;
    v_plan_id := NEW.plan_id;
  END IF;

  -- Only proceed if we have a plan_id (daily_reading_stats has plan_id)
  -- If invoked from reading_progress, we also have plan_id.
  
  -- Get the user's *current shared plan* or the plan being updated?
  -- Leaderboard shows stats for the *shared_plan_id*.
  -- If the update is for a plan that is NOT the shared plan, we might not need to update the global stat
  -- unless we want to track "total reading across all plans".
  -- But usually leaderboard is per "Active Plan".
  -- Let's check if the updated plan is the user's shared plan.
  
  -- However, for simplicity and robustness, let's just recalculate based on the user's CURRENT shared_plan_id.
  
  SELECT shared_plan_id INTO v_plan_id FROM users WHERE id = v_user_id;
  
  IF v_plan_id IS NULL THEN
    -- User has no active shared plan, reset stats
    UPDATE users 
    SET achievement_rate = 0, completed_chapters_count = 0, last_stat_update = NOW()
    WHERE id = v_user_id;
    RETURN NULL;
  END IF;

  -- Fetch Plan Info
  SELECT * INTO v_plan_row FROM plans WHERE id = v_plan_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- 1. Calculate Total Completed Chapters (Count from reading_progress)
  -- Note: We need to handle partial completions (array length) and full completions (schedule lookups).
  -- This calculation is heavy to do in a trigger.
  
  -- OPTIMIZATION: Instead of full Recalculation, we can rely on `daily_reading_stats` sum?
  -- `daily_reading_stats` stores the *delta* of chapters read per day.
  -- Summing `count` from `daily_reading_stats` for this plan gives the total completed chapters accurately!
  
  SELECT COALESCE(SUM(count), 0) INTO v_completed_chapters
  FROM daily_reading_stats
  WHERE user_id = v_user_id AND plan_id = v_plan_id;

  -- 2. Calculate Total Chapters in Plan (to get rate)
  -- We need the total count of the plan.
  -- This is constant for a preset, but variable for custom.
  -- We can cache this in the `plans` table too, but for now let's roughly estimate or compute.
  -- Since we cannot easily compute plan total in PLPGSQL without complex logic or stored total,
  -- let's add `total_chapters` to `plans` table or `preset_plans` table in a future migration.
  
  -- Fallback: Use a simpler approximation or 1189 (Bible total) if it's a full plan?
  -- No, we must be accurate.
  -- Let's try to query the schedule count.
  
  IF v_plan_row.preset_id IS NOT NULL THEN
     -- Preset: Count rows in preset_schedules * average chapters? No.
     -- We need strict parsing.
     -- This is too heavy for a trigger.
     
     -- ALTERNATIVE: Do not calculate RATE here. Just store COUNT.
     -- Clients can calculate Rate if they know the Plan Total.
     -- BUT Leaderboard needs to sort by RATE.
     
     -- Workaround: For now, we will update `completed_chapters_count` efficiently.
     -- We will try to get `total_chapters` if available, or 0.
     -- We will add a `total_chapters` column to `plans` later.
     NULL; 
  END IF;

  -- For this migration, we will focus on `completed_chapters_count`.
  -- Leaderboard sorting by Rate might still need client-side math if we don't have Plan Total.
  -- HOWEVER, calculating Plan Total on every read is bad.
  -- Plan Total should be calculated ONCE when Plan is created.
  
  UPDATE users
  SET completed_chapters_count = v_completed_chapters,
      last_stat_update = NOW()
  WHERE id = v_user_id;

  RETURN NULL;
END;
$$;

-- 3. Trigger on daily_reading_stats changes
DROP TRIGGER IF EXISTS tr_update_user_stats ON daily_reading_stats;
CREATE TRIGGER tr_update_user_stats
AFTER INSERT OR UPDATE OR DELETE ON daily_reading_stats
FOR EACH ROW
EXECUTE FUNCTION update_user_stats_cache();

-- 4. One-time Backfill (Calculate initial values from existing daily_reading_stats)
UPDATE users u
SET completed_chapters_count = (
  SELECT COALESCE(SUM(count), 0)
  FROM daily_reading_stats d
  WHERE d.user_id = u.id AND d.plan_id = u.shared_plan_id
),
last_stat_update = NOW();
