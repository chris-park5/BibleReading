/**
 * Progress Routes
 */

import { Context } from "npm:hono";
import { getSupabaseClient, fetchUserProgress, handleError } from "./utils.ts";
import type { UpdateProgressRequest } from "./types.ts";

const supabase = getSupabaseClient();

export async function updateProgress(c: Context) {
  try {
    const userId = c.get("userId");
    const body = await c.req.json();
    const { planId, day, completed, readingIndex, readingCount, completedChapters } = body as UpdateProgressRequest;
    
    console.log(`[updateProgress] planId=${planId}, day=${day}, idx=${readingIndex}, completed=${completed}, count=${readingCount}, chapters=${JSON.stringify(completedChapters)}`);

    if (!planId || day === undefined || readingIndex === undefined) {
      return c.json({ error: "Plan ID, day, and reading index required" }, 400);
    }

    // 1. Calculate Delta (Previous vs New)
    const { data: prevRow } = await supabase
      .from("reading_progress")
      .select("completed_chapters")
      .eq("user_id", userId)
      .eq("plan_id", planId)
      .eq("day", day)
      .eq("reading_index", readingIndex)
      .maybeSingle();

    let prevCount = 0;
    if (prevRow) {
      if (prevRow.completed_chapters === null) {
        // Was fully completed. Use current readingCount as best estimate of previous total.
        prevCount = readingCount ?? 0;
      } else {
        prevCount = prevRow.completed_chapters.length;
      }
    }

    let newCount = 0;
    if (completed) {
      newCount = readingCount ?? 0;
    } else if (completedChapters && completedChapters.length > 0) {
      newCount = completedChapters.length;
    } else {
      newCount = 0;
    }

    const delta = newCount - prevCount;

    // 2. Update Daily Stats if there is a change
    if (delta !== 0) {
      const today = new Date().toISOString().split('T')[0];
      const { error: rpcError } = await supabase.rpc("increment_daily_reading_stat", {
        p_user_id: userId,
        p_plan_id: planId,
        p_date: today,
        p_delta: delta,
      });
      if (rpcError) {
        console.error("Failed to update daily stats:", rpcError);
        // We don't fail the whole request, but log it.
      }
    }

    if (completed) {
      // 완료 표시 (전체 완료는 completed_chapters = null)
      const { error } = await supabase.from("reading_progress").upsert(
        {
          user_id: userId,
          plan_id: planId,
          day,
          reading_index: readingIndex,
          completed_at: new Date().toISOString(),
          completed_chapters: null,
        },
        { onConflict: "user_id, plan_id, day, reading_index" }
      );

      if (error) throw error;
    } else if (completedChapters && completedChapters.length > 0) {
       // 부분 완료 (세분화된 체크)
       const { error } = await supabase.from("reading_progress").upsert(
        {
          user_id: userId,
          plan_id: planId,
          day,
          reading_index: readingIndex,
          completed_at: new Date().toISOString(),
          completed_chapters: completedChapters,
        },
        { onConflict: "user_id, plan_id, day, reading_index" }
      );
      if (error) throw error;
    } else {
      // 완료 취소
      const { error } = await supabase
        .from("reading_progress")
        .delete()
        .eq("user_id", userId)
        .eq("plan_id", planId)
        .eq("day", day)
        .eq("reading_index", readingIndex);

      if (error) throw error;
    }

    // 업데이트된 진도 반환
    const progress = await fetchUserProgress(userId, planId);
    return c.json({ success: true, progress });
  } catch (error) {
    return c.json(handleError(error, "Failed to update progress"), 500);
  }
}

export async function getProgress(c: Context) {
  try {
    const userId = c.get("userId");
    const planId = c.req.query("planId");

    if (!planId) {
      return c.json({ error: "Plan ID is required" }, 400);
    }

    const progress = await fetchUserProgress(userId, planId);
    return c.json({ success: true, progress });
  } catch (error) {
    return c.json(handleError(error, "Failed to get progress"), 500);
  }
}

export async function getDailyStats(c: Context) {
  try {
    const userId = c.get("userId");
    const planId = c.req.query("planId");

    let query = supabase
      .from("daily_reading_stats")
      .select("date, count")
      .eq("user_id", userId);

    if (planId) {
      query = query.eq("plan_id", planId);
    }
    
    // Sort by date desc
    query = query.order("date", { ascending: false });

    const { data, error } = await query;

    if (error) throw error;

    return c.json({ success: true, stats: data });
  } catch (error) {
    return c.json(handleError(error, "Failed to get daily stats"), 500);
  }
}

