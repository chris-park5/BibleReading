-- ==============================================================================
-- 25. Fix Progress Function Ambiguity (PGRST203) & Support Fractional Counts
-- ==============================================================================

-- 1. Drop existing overloaded functions explicitly to resolve ambiguity
DROP FUNCTION IF EXISTS public.handle_reading_progress_update(uuid, uuid, integer, integer, boolean, integer, text[], date);
DROP FUNCTION IF EXISTS public.handle_reading_progress_update(uuid, uuid, integer, integer, boolean, numeric, text[], date);

-- 2. Re-create function with NUMERIC p_reading_count
CREATE OR REPLACE FUNCTION handle_reading_progress_update(
  p_user_id UUID,
  p_plan_id UUID,
  p_day INTEGER,
  p_reading_index INTEGER,
  p_completed BOOLEAN,
  p_reading_count NUMERIC, -- Changed to NUMERIC
  p_completed_chapters TEXT[],
  p_stats_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_progress_row reading_progress%ROWTYPE;
  v_prev_count NUMERIC := 0; -- Changed to NUMERIC
  v_new_count NUMERIC := 0;  -- Changed to NUMERIC
  v_delta NUMERIC := 0;      -- Changed to NUMERIC
  v_total_completed NUMERIC(10, 2) := 0;
BEGIN
  -- 0. Serialize execution
  PERFORM 1 FROM users WHERE id = p_user_id FOR UPDATE;

  -- 1. Lock & Get Previous State
  SELECT * INTO v_progress_row
  FROM reading_progress
  WHERE user_id = p_user_id 
    AND plan_id = p_plan_id 
    AND day = p_day 
    AND reading_index = p_reading_index
  FOR UPDATE;

  -- Calculate Previous Count
  IF FOUND THEN
    IF v_progress_row.completed_chapters IS NULL THEN
      -- Was fully complete. Trust the passed reading count (as it comes from the current schedule)
      -- or ideally we should have stored the count. But since we didn't, we assume the schedule hasn't changed drastically.
      v_prev_count := COALESCE(p_reading_count, 0); 
    ELSE
      -- Was partially complete (array length)
      -- NOTE: array_length returns integer. If we want fractional partials, we'd need complex logic.
      -- For now, partial completion via checkbox array is still 1 chapter = 1 unit?
      -- If the user completes specific chapters, we count them as integers.
      -- If `p_reading_count` is fractional (e.g. 0.25), checking all chapters means full 0.25.
      -- If partial, we assume integer count of chapters checked? 
      -- This is a mismatch: `chapter_count` is fractional, but `completed_chapters` is a list of chapter strings.
      -- For now, we cast array length to numeric.
      v_prev_count := COALESCE(array_length(v_progress_row.completed_chapters, 1), 0)::NUMERIC;
    END IF;
  ELSE
    v_prev_count := 0;
  END IF;

  -- 2. Calculate New Count
  IF p_completed THEN
    v_new_count := COALESCE(p_reading_count, 0);
  ELSIF p_completed_chapters IS NOT NULL THEN
    v_new_count := COALESCE(array_length(p_completed_chapters, 1), 0)::NUMERIC;
  ELSE
    v_new_count := 0;
  END IF;

  v_delta := v_new_count - v_prev_count;

  -- 3. Update reading_progress Table
  IF p_completed THEN
    INSERT INTO reading_progress (user_id, plan_id, day, reading_index, completed_at, completed_chapters)
    VALUES (p_user_id, p_plan_id, p_day, p_reading_index, NOW(), NULL)
    ON CONFLICT (user_id, plan_id, day, reading_index)
    DO UPDATE SET completed_at = NOW(), completed_chapters = NULL;
    
  ELSIF v_new_count > 0 THEN
    INSERT INTO reading_progress (user_id, plan_id, day, reading_index, completed_at, completed_chapters)
    VALUES (p_user_id, p_plan_id, p_day, p_reading_index, NOW(), p_completed_chapters)
    ON CONFLICT (user_id, plan_id, day, reading_index)
    DO UPDATE SET completed_at = NOW(), completed_chapters = p_completed_chapters;
    
  ELSE
    DELETE FROM reading_progress
    WHERE user_id = p_user_id 
      AND plan_id = p_plan_id 
      AND day = p_day 
      AND reading_index = p_reading_index;
  END IF;

  -- 4. Update Stats (If delta exists)
  -- Note: We use a small epsilon for float comparison just in case, but numeric is exact.
  IF v_delta <> 0 THEN
    -- A. Daily Stats (For Graphs)
    INSERT INTO daily_reading_stats (user_id, plan_id, date, count)
    VALUES (p_user_id, p_plan_id, p_stats_date, v_delta)
    ON CONFLICT (user_id, plan_id, date)
    DO UPDATE SET 
      count = daily_reading_stats.count + EXCLUDED.count,
      updated_at = NOW();

    -- B. User Plan Stats (For Leaderboard) - RECALCULATE from Daily Stats
    SELECT COALESCE(SUM(count), 0) INTO v_total_completed
    FROM daily_reading_stats
    WHERE user_id = p_user_id AND plan_id = p_plan_id;

    INSERT INTO user_plan_stats (user_id, plan_id, completed_chapters, last_read_date, updated_at)
    VALUES (p_user_id, p_plan_id, v_total_completed, p_stats_date, NOW())
    ON CONFLICT (user_id, plan_id)
    DO UPDATE SET
      completed_chapters = v_total_completed,
      last_read_date = GREATEST(user_plan_stats.last_read_date, EXCLUDED.last_read_date),
      updated_at = NOW();
      
  END IF;

  RETURN jsonb_build_object('success', true, 'delta', v_delta);
END;
$$;
