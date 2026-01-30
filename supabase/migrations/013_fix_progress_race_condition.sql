-- ==============================================================================
-- 13. Fix Progress Race Condition & Atomic Stats Update
-- ==============================================================================

-- Atomic function to handle progress update and stats increment in a single transaction
CREATE OR REPLACE FUNCTION handle_reading_progress_update(
  p_user_id UUID,
  p_plan_id UUID,
  p_day INTEGER,
  p_reading_index INTEGER,
  p_completed BOOLEAN,
  p_reading_count INTEGER, -- Total chapters count for this reading (from client)
  p_completed_chapters TEXT[], -- Partial completed chapters list
  p_stats_date DATE -- Local date for stats
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
  -- 1. Lock & Get Previous State
  -- FOR UPDATE ensures that concurrent requests for the same reading wait
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
      -- Previously fully completed. Use p_reading_count as the best estimate.
      v_prev_count := COALESCE(p_reading_count, 0); 
    ELSE
      -- Previously partially completed. Use COALESCE because array_length returns NULL for empty.
      v_prev_count := COALESCE(array_length(v_progress_row.completed_chapters, 1), 0);
    END IF;
  ELSE
    -- No previous record
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
    -- Full Completion
    INSERT INTO reading_progress (user_id, plan_id, day, reading_index, completed_at, completed_chapters)
    VALUES (p_user_id, p_plan_id, p_day, p_reading_index, NOW(), NULL)
    ON CONFLICT (user_id, plan_id, day, reading_index)
    DO UPDATE SET completed_at = NOW(), completed_chapters = NULL;
    
  ELSIF v_new_count > 0 THEN
    -- Partial Completion
    INSERT INTO reading_progress (user_id, plan_id, day, reading_index, completed_at, completed_chapters)
    VALUES (p_user_id, p_plan_id, p_day, p_reading_index, NOW(), p_completed_chapters)
    ON CONFLICT (user_id, plan_id, day, reading_index)
    DO UPDATE SET completed_at = NOW(), completed_chapters = p_completed_chapters;
    
  ELSE
    -- Not Completed (Delete)
    DELETE FROM reading_progress
    WHERE user_id = p_user_id 
      AND plan_id = p_plan_id 
      AND day = p_day 
      AND reading_index = p_reading_index;
  END IF;

  -- 4. Update Daily Stats (if delta != 0)
  -- We reuse the existing increment function logic but call it directly here
  IF v_delta <> 0 THEN
    INSERT INTO daily_reading_stats (user_id, plan_id, date, count)
    VALUES (p_user_id, p_plan_id, p_stats_date, v_delta)
    ON CONFLICT (user_id, plan_id, date)
    DO UPDATE SET 
      count = daily_reading_stats.count + EXCLUDED.count,
      updated_at = NOW();
  END IF;

  RETURN jsonb_build_object('success', true, 'delta', v_delta);
END;
$$;
