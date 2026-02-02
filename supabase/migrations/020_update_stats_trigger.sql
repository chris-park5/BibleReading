-- ==============================================================================
-- 20. Update Progress Function to maintain user_plan_stats
-- ==============================================================================

CREATE OR REPLACE FUNCTION handle_reading_progress_update(
  p_user_id UUID,
  p_plan_id UUID,
  p_day INTEGER,
  p_reading_index INTEGER,
  p_completed BOOLEAN,
  p_reading_count INTEGER,
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
  v_prev_count INTEGER := 0;
  v_new_count INTEGER := 0;
  v_delta INTEGER := 0;
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
      v_prev_count := COALESCE(p_reading_count, 0); 
    ELSE
      v_prev_count := COALESCE(array_length(v_progress_row.completed_chapters, 1), 0);
    END IF;
  ELSE
    v_prev_count := 0;
  END IF;

  -- 2. Calculate New Count
  IF p_completed THEN
    v_new_count := COALESCE(p_reading_count, 0);
  ELSIF p_completed_chapters IS NOT NULL THEN
    v_new_count := COALESCE(array_length(p_completed_chapters, 1), 0);
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
  IF v_delta <> 0 THEN
    -- A. Daily Stats (For Graphs)
    INSERT INTO daily_reading_stats (user_id, plan_id, date, count)
    VALUES (p_user_id, p_plan_id, p_stats_date, v_delta)
    ON CONFLICT (user_id, plan_id, date)
    DO UPDATE SET 
      count = daily_reading_stats.count + EXCLUDED.count,
      updated_at = NOW();

    -- B. User Plan Stats (For Leaderboard - NEW)
    INSERT INTO user_plan_stats (user_id, plan_id, completed_chapters, last_read_date, updated_at)
    VALUES (p_user_id, p_plan_id, v_delta, p_stats_date, NOW())
    ON CONFLICT (user_id, plan_id)
    DO UPDATE SET
      completed_chapters = user_plan_stats.completed_chapters + EXCLUDED.completed_chapters,
      last_read_date = GREATEST(user_plan_stats.last_read_date, EXCLUDED.last_read_date),
      updated_at = NOW();
  END IF;

  RETURN jsonb_build_object('success', true, 'delta', v_delta);
END;
$$;
